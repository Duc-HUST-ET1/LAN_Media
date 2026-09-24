import 'dotenv/config';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdir, rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { setTimeout as delay } from 'node:timers/promises';
import test from 'node:test';
import WebSocket from 'ws';

async function unusedPort() {
  const server = createServer();
  await new Promise((resolveListen, reject) => server.once('error', reject).listen(0, '127.0.0.1', resolveListen));
  const port = server.address().port;
  await new Promise(resolveClose => server.close(resolveClose));
  return port;
}
async function register(baseUrl, username) {
  const response = await fetch(`${baseUrl}/api/auth/register`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, email: `${username}@example.test`, password: 'TestPassword123!', displayName: username }) });
  assert.equal(response.status, 201, await response.clone().text());
  return { user: (await response.json()).user, cookie: response.headers.get('set-cookie').split(';')[0] };
}
async function waitForHealth(url, child) {
  for (let attempt = 0; attempt < 100; attempt++) {
    if (child.exitCode !== null) throw new Error(`Backend exited early with code ${child.exitCode}`);
    try { if ((await fetch(`${url}/api/health`)).status === 200) return; } catch { /* startup */ }
    await delay(250);
  }
  throw new Error('File transfer backend did not become ready.');
}
function connect(url, cookie) {
  return new Promise((resolveSocket, reject) => {
    const socket = new WebSocket(url, { headers: { Cookie: cookie } });
    socket.once('open', () => resolveSocket(socket)); socket.once('error', reject);
  });
}
function nextEvent(socket, predicate) {
  return new Promise((resolveEvent, reject) => {
    const timer = setTimeout(() => { cleanup(); reject(new Error('Timed out waiting for file message event.')); }, 5000);
    const handler = data => { const event = JSON.parse(String(data)); if (predicate(event)) { cleanup(); resolveEvent(event); } };
    function cleanup() { clearTimeout(timer); socket.off('message', handler); }
    socket.on('message', handler);
  });
}
async function createConversation(baseUrl, cookie, path, body) {
  const response = await fetch(`${baseUrl}/api/conversations/${path}`, { method: 'POST', headers: { Cookie: cookie, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  assert.equal(response.status, 201, await response.clone().text());
  return (await response.json()).conversation.id;
}
async function upload(baseUrl, cookie, conversationId, name, content, mimeType = 'text/plain') {
  const form = new FormData(); form.append('file', new Blob([content], { type: mimeType }), name);
  return fetch(`${baseUrl}/api/files/upload`, { method: 'POST', headers: { Cookie: cookie, 'X-Conversation-Id': conversationId }, body: form });
}

test('authenticated file transfer persists metadata, broadcasts metadata, enforces membership and cleans rejected uploads', async t => {
  let database;
  try {
    const mysql = await import('mysql2/promise');
    database = await mysql.createConnection({ host: process.env.DB_HOST ?? '127.0.0.1', port: Number(process.env.DB_PORT ?? 3306), database: process.env.DB_NAME, user: process.env.DB_USER, password: process.env.DB_PASSWORD, connectTimeout: 2500 });
    await database.ping();
  } catch {
    await database?.end().catch(() => {});
    t.skip('MySQL is not configured/reachable; file transfer integration requires the Phase 2 database.'); return;
  }
  const port = await unusedPort();
  const suffix = randomUUID().replaceAll('-', '').slice(0, 10);
  const names = [`p4a_${suffix}`, `p4b_${suffix}`, `p4c_${suffix}`];
  const uploadDirectory = resolve('storage', `integration-uploads-${suffix}`);
  await mkdir(uploadDirectory, { recursive: true });
  const backend = spawn(process.execPath, ['backend/dist/main.js'], { env: { ...process.env, HOST: '127.0.0.1', PORT: String(port), MAX_FILE_SIZE: '1048576', UPLOAD_DIR: uploadDirectory, ALLOWED_FILE_TYPES: '*' }, stdio: 'ignore' });
  const baseUrl = `http://127.0.0.1:${port}`;
  let alice; let bob; let charlie; let socketB;
  t.after(async () => {
    if (socketB?.readyState === WebSocket.OPEN) socketB.close();
    backend.kill();
    if (database) {
      await database.execute('DELETE FROM conversations WHERE created_by IN (SELECT id FROM users WHERE username IN (?, ?, ?))', names);
      await database.execute('DELETE FROM users WHERE username IN (?, ?, ?)', names);
      await database.end();
    }
    await rm(uploadDirectory, { recursive: true, force: true });
  });
  await waitForHealth(baseUrl, backend);
  [alice, bob, charlie] = await Promise.all(names.map(name => register(baseUrl, name)));
  const directId = await createConversation(baseUrl, alice.cookie, 'direct', { userId: bob.user.id });
  const groupId = await createConversation(baseUrl, alice.cookie, 'group', { name: 'File transfer group', memberIds: [bob.user.id] });
  socketB = await connect(`ws://127.0.0.1:${port}/ws`, bob.cookie);

  const bytes = Buffer.from('LAN transfer bytes\n');
  const eventPromise = nextEvent(socketB, event => event.type === 'chat.message' && event.payload?.message?.type === 'FILE');
  const uploaded = await upload(baseUrl, alice.cookie, directId, 'small.txt', bytes);
  assert.equal(uploaded.status, 201, await uploaded.clone().text());
  const message = (await uploaded.json()).message;
  const event = await eventPromise;
  assert.deepEqual(event.payload.message.file, message.file);
  assert.equal('binary' in event.payload.message, false);
  assert.equal(message.type, 'FILE');

  const [fileRows] = await database.execute('SELECT owner_id, conversation_id, message_id, storage_path, size_bytes FROM files WHERE id = ?', [message.file.id]);
  assert.equal(fileRows.length, 1);
  assert.equal(fileRows[0].owner_id, alice.user.id);
  assert.equal(fileRows[0].conversation_id, directId);
  assert.equal(fileRows[0].message_id, message.id);
  assert.match(fileRows[0].storage_path, /^[0-9a-f-]{36}$/i);
  assert.equal(Number(fileRows[0].size_bytes), bytes.length);
  const history = await fetch(`${baseUrl}/api/conversations/${directId}/messages`, { headers: { Cookie: bob.cookie } });
  assert.equal((await history.json()).messages.at(-1).file.id, message.file.id);

  const download = await fetch(`${baseUrl}${message.file.downloadUrl}`, { headers: { Cookie: bob.cookie } });
  assert.equal(download.status, 200);
  assert.equal(download.headers.get('content-disposition').includes('small.txt'), true);
  assert.deepEqual(Buffer.from(await download.arrayBuffer()), bytes);
  const unauthorized = await fetch(`${baseUrl}${message.file.downloadUrl}`, { headers: { Cookie: charlie.cookie } });
  assert.equal(unauthorized.status, 403);
  const anonymous = await fetch(`${baseUrl}${message.file.downloadUrl}`);
  assert.equal(anonymous.status, 401);

  const imageBytes = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);
  const imageUpload = await upload(baseUrl, alice.cookie, directId, 'sample.png', imageBytes, 'image/png');
  assert.equal(imageUpload.status, 201, await imageUpload.clone().text());
  const imageMessage = (await imageUpload.json()).message;
  assert.equal(imageMessage.file.mimeType, 'image/png');
  const imageDownload = await fetch(`${baseUrl}${imageMessage.file.downloadUrl}`, { headers: { Cookie: bob.cookie } });
  assert.deepEqual(Buffer.from(await imageDownload.arrayBuffer()), imageBytes);

  const largeBytes = Buffer.alloc(512 * 1024);
  for (let index = 0; index < largeBytes.length; index++) largeBytes[index] = index % 251;
  const largeUpload = await upload(baseUrl, alice.cookie, directId, 'large.bin', largeBytes, 'application/octet-stream');
  assert.equal(largeUpload.status, 201, await largeUpload.clone().text());
  const largeMessage = (await largeUpload.json()).message;
  assert.equal(largeMessage.file.size, largeBytes.length);
  const largeDownload = await fetch(`${baseUrl}${largeMessage.file.downloadUrl}`, { headers: { Cookie: bob.cookie } });
  assert.deepEqual(Buffer.from(await largeDownload.arrayBuffer()), largeBytes);

  socketB.close(); await new Promise(resolveClose => socketB.once('close', resolveClose));
  const groupUpload = await upload(baseUrl, alice.cookie, groupId, 'group.txt', Buffer.from('offline recipient'));
  assert.equal(groupUpload.status, 201, await groupUpload.clone().text());
  const groupMessage = (await groupUpload.json()).message;
  const offlineHistory = await fetch(`${baseUrl}/api/conversations/${groupId}/messages`, { headers: { Cookie: bob.cookie } });
  assert.ok((await offlineHistory.json()).messages.some(item => item.id === groupMessage.id));
  const groupDownload = await fetch(`${baseUrl}${groupMessage.file.downloadUrl}`, { headers: { Cookie: bob.cookie } });
  assert.equal(groupDownload.status, 200);
  assert.equal(Buffer.from(await groupDownload.arrayBuffer()).toString(), 'offline recipient');
  const nonMember = await fetch(`${baseUrl}${groupMessage.file.downloadUrl}`, { headers: { Cookie: charlie.cookie } });
  assert.equal(nonMember.status, 403);

  const malicious = await upload(baseUrl, alice.cookie, directId, '../..\\passwd', Buffer.from('safe key'));
  assert.equal(malicious.status, 201, await malicious.clone().text());
  const maliciousMessage = (await malicious.json()).message;
  const [safeRows] = await database.execute('SELECT original_name, storage_path FROM files WHERE id = ?', [maliciousMessage.file.id]);
  assert.doesNotMatch(safeRows[0].storage_path, /[\\/]|\.\./);
  assert.doesNotMatch(safeRows[0].original_name, /[\\/]|\.\./);

  const rejected = await upload(baseUrl, alice.cookie, directId, 'oversized.txt', Buffer.alloc(1048577, 1));
  assert.equal(rejected.status, 413);
  const [oversizedRows] = await database.execute('SELECT COUNT(*) AS count FROM files WHERE conversation_id = ? AND original_name = ?', [directId, 'oversized.txt']);
  assert.equal(Number(oversizedRows[0].count), 0);
});
