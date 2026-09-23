import assert from 'node:assert/strict';
import test from 'node:test';
import { UserRepository } from '../../backend/dist/repositories/UserRepository.js';

test('user lookup passes input as SQL parameters instead of concatenating it', async () => {
  let seen;
  const database = {
    async query(sql, values) { seen = { sql, values }; return []; },
  };
  const repository = new UserRepository(database);
  const input = "alice' OR 1=1 --";
  assert.equal(await repository.existsByUsername(input), false);
  assert.match(seen.sql, /username = \?/);
  assert.equal(seen.sql.includes(input), false);
  assert.deepEqual(seen.values, [input]);
});
