import 'dotenv/config';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { setTimeout as delay } from 'node:timers/promises';
import test from 'node:test';
import WebSocket from 'ws';

async function unusedPort() {
  const server = createServer();
  await new Promise((resolve, reject) => server.once('error', reject).listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  await new Promise(resolve => server.close(resolve));
  return port;
}
async function waitForHealth(url, child) {
  for (let attempt = 0; attempt < 100; attempt++) {
    if (child.exitCode !== null) throw new Error(`Backend exited early with code ${child.exitCode}`);
    try { const response = await fetch(`${url}/api/health`); if (response.status === 200) return; } catch { /* Wait for startup. */ }
    await delay(250);
  }
  throw new Error('MySQL backend did not become ready.');
}
async function register(baseUrl, username) {
  const response = await fetch(`${baseUrl}/api/auth/register`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, email: `${username}@example.test`, password: 'TestPassword123!', displayName: username }) });
  assert.equal(response.status, 201, await response.clone().text());
  return { user: (await response.json()).user, cookie: response.headers.get('set-cookie').split(';')[0] };
}
function nextEvent(socket, predicate = () => true) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { cleanup(); reject(new Error('Timed out waiting for WebSocket event.')); }, 5000);
    const onMessage = data => { const event = JSON.parse(String(data)); if (predicate(event)) { cleanup(); resolve(event); } };
    const onError = error => { cleanup(); reject(error); };
    function cleanup() { clearTimeout(timer); socket.off('message', onMessage); socket.off('error', onError); }
    socket.on('message', onMessage); socket.on('error', onError);
  });
}
function connect(url, cookie) {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(url, { headers: cookie ? { Cookie: cookie } : {} });
    socket.once('open', () => resolve(socket)); socket.once('error', reject);
  });
}

test('authenticated WebSocket chat, presence and persistent conversations work', async t => {
  let database;
  try {
    const mysql = await import('mysql2/promise');
    database = await mysql.createConnection({ host: process.env.DB_HOST ?? '127.0.0.1', port: Number(process.env.DB_PORT ?? 3306), database: process.env.DB_NAME, user: process.env.DB_USER, password: process.env.DB_PASSWORD, connectTimeout: 2500 });
    await database.ping();
  } catch {
    await database?.end().catch(() => {});
    t.skip('MySQL is not configured/reachable; Phase 3 chat integration requires the Phase 2 database.'); return;
  }
  const port = await unusedPort();
  const backend = spawn(process.execPath, ['backend/dist/main.js'], { env: { ...process.env, HOST: '127.0.0.1', PORT: String(port) }, stdio: 'ignore' });
  const baseUrl = `http://127.0.0.1:${port}`;
  const wsUrl = `ws://127.0.0.1:${port}/ws`;
  const suffix = randomUUID().replaceAll('-', '').slice(0, 10);
  const nameA = `p3a_${suffix}`; const nameB = `p3b_${suffix}`;
  let alice; let bob; let socketA; let socketA2; let socketB; let directId; let groupId;
  t.after(async () => {
    for (const socket of [socketA, socketA2, socketB]) if (socket?.readyState === WebSocket.OPEN) socket.close();
    backend.kill();
    if (database) {
      await database.execute('DELETE FROM conversations WHERE created_by IN (SELECT id FROM users WHERE username IN (?, ?))', [nameA, nameB]);
      await database.execute('DELETE FROM users WHERE username IN (?, ?)', [nameA, nameB]);
      await database.end();
    }
  });
  await waitForHealth(baseUrl, backend);
  alice = await register(baseUrl, nameA); bob = await register(baseUrl, nameB);
  const noAuth = await fetch(`${baseUrl}/api/conversations`);
  assert.equal(noAuth.status, 401);
  const opened = await fetch(`${baseUrl}/api/conversations/direct`, { method: 'POST', headers: { Cookie: alice.cookie, 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: bob.user.id }) });
  assert.equal(opened.status, 201, await opened.clone().text()); directId = (await opened.json()).conversation.id;
  const openedAgain = await fetch(`${baseUrl}/api/conversations/direct`, { method: 'POST', headers: { Cookie: alice.cookie, 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: bob.user.id }) });
  assert.equal((await openedAgain.json()).conversation.id, directId);
  const alterDirect = await fetch(`${baseUrl}/api/conversations/${directId}/members`, { method: 'POST', headers: { Cookie: alice.cookie, 'Content-Type': 'application/json' }, body: JSON.stringify({ memberIds: [bob.user.id] }) });
  assert.equal(alterDirect.status, 400);
  socketA = await connect(wsUrl, alice.cookie); socketB = await connect(wsUrl, bob.cookie);
  const online = await fetch(`${baseUrl}/api/users/online`, { headers: { Cookie: alice.cookie } });
  assert.deepEqual((await online.json()).users.map(user => user.id).sort(), [alice.user.id, bob.user.id].sort());
  const eventForB = nextEvent(socketB, event => event.type === 'chat.message');
  const eventForA = nextEvent(socketA, event => event.type === 'chat.message');
  socketA.send(JSON.stringify({ type: 'chat.send', requestId: 'phase3-test', payload: { conversationId: directId, content: 'Realtime LAN message' } }));
  assert.equal((await eventForB).payload.message.content, 'Realtime LAN message');
  assert.equal((await eventForA).payload.message.senderId, alice.user.id);
  const history = await fetch(`${baseUrl}/api/conversations/${directId}/messages`, { headers: { Cookie: bob.cookie } });
  assert.equal((await history.json()).messages[0].content, 'Realtime LAN message');
  socketA2 = await connect(wsUrl, alice.cookie);
  socketA.close();
  await new Promise(resolve => socketA.once('close', resolve));
  const stillOnline = await fetch(`${baseUrl}/api/users/online`, { headers: { Cookie: bob.cookie } });
  assert.ok((await stillOnline.json()).users.some(user => user.id === alice.user.id));
  const wentOffline = nextEvent(socketB, event => event.type === 'presence.offline' && event.payload.userId === alice.user.id);
  socketA2.close();
  await new Promise(resolve => socketA2.once('close', resolve));
  assert.equal((await wentOffline).type, 'presence.offline');
  socketA = await connect(wsUrl, alice.cookie);
  const group = await fetch(`${baseUrl}/api/conversations/group`, { method: 'POST', headers: { Cookie: alice.cookie, 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'Phase Three', memberIds: [bob.user.id] }) });
  assert.equal(group.status, 201, await group.clone().text()); groupId = (await group.json()).conversation.id;
  const forbidden = await fetch(`${baseUrl}/api/conversations/${groupId}/members`, { method: 'POST', headers: { Cookie: bob.cookie, 'Content-Type': 'application/json' }, body: JSON.stringify({ memberIds: [alice.user.id] }) });
  assert.equal(forbidden.status, 403);
  const unauthenticated = new WebSocket(wsUrl);
  const closeCode = await new Promise(resolve => unauthenticated.once('close', code => resolve(code)));
  assert.equal(closeCode, 4401);
});
