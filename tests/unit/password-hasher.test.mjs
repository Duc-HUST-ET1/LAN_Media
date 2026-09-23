import assert from 'node:assert/strict';
import test from 'node:test';
import { PasswordHasher } from '../../backend/dist/core/security/PasswordHasher.js';

test('password hashes are salted and verify without storing the password', async () => {
  const hasher = new PasswordHasher();
  const password = 'TestPassword123!';
  const first = await hasher.hash(password);
  const second = await hasher.hash(password);

  assert.notEqual(first, password);
  assert.notEqual(first, second);
  assert.match(first, /^scrypt\$32768\$8\$1\$/);
  assert.equal(await hasher.verify(password, first), true);
  assert.equal(await hasher.verify('WrongPassword123!', first), false);
});
