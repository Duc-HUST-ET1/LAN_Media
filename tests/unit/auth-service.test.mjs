import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import { AuthService } from '../../backend/dist/services/AuthService.js';

function makeService() {
  const users = new Map();
  const sessions = new Map();
  const userRepository = {
    async existsByUsername(username) { return [...users.values()].some((user) => user.username === username); },
    async existsByEmail(email) { return [...users.values()].some((user) => user.email === email); },
    async createUser(input) {
      const user = { id: crypto.randomUUID(), ...input, avatar: null, role: 'USER', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
      users.set(user.id, user);
      return user;
    },
    async findByLogin(login) { return [...users.values()].find((user) => user.username === login || user.email === login) ?? null; },
  };
  const sessionRepository = {
    async createSession(userId, tokenHash, expiresAt) { sessions.set(tokenHash, { userId, expiresAt }); return 'session-id'; },
    async revokeSession(tokenHash) { sessions.delete(tokenHash); },
  };
  return { service: new AuthService(userRepository, sessionRepository), users, sessions };
}

test('registration validates inputs, stores a hash and creates a session', async () => {
  const { service, users, sessions } = makeService();
  const registered = await service.register({ username: 'Alice_1', email: 'ALICE@example.com', displayName: 'Alice', password: 'TestPassword123!' });

  assert.equal(registered.user.username, 'alice_1');
  assert.equal(registered.user.email, 'alice@example.com');
  assert.equal('passwordHash' in registered.user, false);
  assert.equal([...users.values()][0].passwordHash === 'TestPassword123!', false);
  assert.match([...users.values()][0].passwordHash, /^scrypt\$/);
  assert.equal(sessions.size, 1);
});

test('registration rejects invalid fields and duplicate accounts', async () => {
  const { service } = makeService();
  await assert.rejects(service.register({ username: 'ab', email: 'bad', displayName: '', password: 'short' }), { statusCode: 400 });
  await service.register({ username: 'alice', email: 'alice@example.com', displayName: 'Alice', password: 'TestPassword123!' });
  await assert.rejects(service.register({ username: 'alice', email: 'another@example.com', displayName: 'Alice', password: 'TestPassword123!' }), { statusCode: 409 });
  await assert.rejects(service.register({ username: 'other', email: 'alice@example.com', displayName: 'Alice', password: 'TestPassword123!' }), { statusCode: 409 });
});

test('login accepts username or email, hides which credential was wrong, and logout revokes the session', async () => {
  const { service, sessions } = makeService();
  await service.register({ username: 'alice', email: 'alice@example.com', displayName: 'Alice', password: 'TestPassword123!' });
  const session = await service.login({ identifier: 'alice@example.com', password: 'TestPassword123!' });
  assert.equal(session.user.username, 'alice');
  await assert.rejects(service.login({ username: 'alice', password: 'WrongPassword123!' }), { statusCode: 401 });
  const hash = createHash('sha256').update(session.token).digest('hex');
  await service.logout(session.token);
  assert.equal(sessions.has(hash), false);
});
