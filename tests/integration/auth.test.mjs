import 'dotenv/config';
import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { setTimeout as delay } from 'node:timers/promises';
import test from 'node:test';
import { PasswordHasher } from '../../backend/dist/core/security/PasswordHasher.js';

async function unusedPort() {
  const server = createServer();
  await new Promise((resolve, reject) => server.once('error', reject).listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  await new Promise((resolve) => server.close(resolve));
  return port;
}

async function waitForHealth(url, child) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (child.exitCode !== null) throw new Error(`Backend exited early with code ${child.exitCode}`);
    try {
      const response = await fetch(`${url}/api/health`);
      const body = await response.json();
      if (body.database === 'connected') return;
    } catch { /* The backend can still be applying its migration. */ }
    await delay(250);
  }
  throw new Error('MySQL did not become ready for the authentication integration test.');
}

test('register, login, protected session, duplicate errors and logout persist in MySQL', async (t) => {
  const mysql = await import('mysql2/promise');
  let database;
  try {
    database = await mysql.createConnection({
      host: process.env.DB_HOST ?? '127.0.0.1',
      port: Number(process.env.DB_PORT ?? 3306),
      database: process.env.DB_NAME,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      connectTimeout: 2500,
    });
    await database.ping();
  } catch {
    await database?.end().catch(() => {});
    t.skip('MySQL is not configured/reachable; set DB_* and create the database before running database integration tests.');
    return;
  }

  const port = await unusedPort();
  const env = { ...process.env, HOST: '127.0.0.1', PORT: String(port) };
  const backend = spawn(process.execPath, ['backend/dist/main.js'], { env, stdio: 'ignore' });
  const baseUrl = `http://127.0.0.1:${port}`;
  const suffix = randomUUID().replaceAll('-', '').slice(0, 10);
  const username = `p2_${suffix}`;
  const email = `${username}@example.test`;
  const password = 'TestPassword123!';
  let userId;

  t.after(async () => {
    backend.kill();
    if (database) {
      await database.execute('DELETE s FROM sessions s JOIN users u ON u.id = s.user_id WHERE u.username = ?', [username]);
      await database.execute('DELETE FROM users WHERE username = ?', [username]);
      await database.end();
    }
  });

  await waitForHealth(baseUrl, backend);

  const unauthenticated = await fetch(`${baseUrl}/api/auth/me`);
  assert.equal(unauthenticated.status, 401);

  const invalid = await fetch(`${baseUrl}/api/auth/register`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'ab', email: 'invalid', password: 'short', displayName: '' }),
  });
  assert.equal(invalid.status, 400);

  const registered = await fetch(`${baseUrl}/api/auth/register`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, email, password, displayName: 'Phase Two Test' }),
  });
  assert.equal(registered.status, 201, await registered.clone().text());
  const registrationBody = await registered.json();
  userId = registrationBody.user.id;
  assert.equal('password' in registrationBody, false);
  assert.equal('passwordHash' in registrationBody.user, false);
  assert.equal('password_hash' in registrationBody.user, false);
  const [userRows] = await database.execute('SELECT password_hash FROM users WHERE id = ?', [userId]);
  const passwordHash = userRows[0]?.password_hash;
  assert.notEqual(passwordHash, password);
  assert.equal(await new PasswordHasher().verify(password, passwordHash), true);

  const duplicateUsername = await fetch(`${baseUrl}/api/auth/register`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, email: `other_${email}`, password, displayName: 'Duplicate' }),
  });
  assert.equal(duplicateUsername.status, 409);
  const duplicateEmail = await fetch(`${baseUrl}/api/auth/register`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: `other_${username}`, email, password, displayName: 'Duplicate' }),
  });
  assert.equal(duplicateEmail.status, 409);

  const badLogin = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password: 'WrongPassword123!' }),
  });
  assert.equal(badLogin.status, 401);

  const login = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: email, password }),
  });
  assert.equal(login.status, 200);
  const loginBody = await login.json();
  assert.equal(loginBody.user.id, userId);
  const setCookie = login.headers.get('set-cookie');
  assert.match(setCookie, /HttpOnly/i);
  const cookiePair = setCookie.split(';')[0];
  const rawToken = decodeURIComponent(cookiePair.slice(cookiePair.indexOf('=') + 1));
  const tokenHash = createHash('sha256').update(rawToken).digest('hex');
  const [sessionRows] = await database.execute('SELECT token_hash FROM sessions WHERE user_id = ? AND token_hash = ?', [userId, tokenHash]);
  assert.equal(sessionRows.length, 1);

  const current = await fetch(`${baseUrl}/api/auth/me`, { headers: { Cookie: cookiePair } });
  assert.equal(current.status, 200);
  assert.equal((await current.json()).user.email, email);

  const logout = await fetch(`${baseUrl}/api/auth/logout`, { method: 'POST', headers: { Cookie: cookiePair } });
  assert.equal(logout.status, 204);
  const afterLogout = await fetch(`${baseUrl}/api/auth/me`, { headers: { Cookie: cookiePair } });
  assert.equal(afterLogout.status, 401);
});
