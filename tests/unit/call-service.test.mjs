import assert from 'node:assert/strict';
import test from 'node:test';
import { CallService } from '../../backend/dist/services/CallService.js';

test('ringing calls expire as missed and release both participants', async () => {
  const service = new CallService(10);
  const missed = new Promise((resolve) => {
    service.start('caller', 'callee', 'voice', resolve);
  });

  const call = await missed;
  assert.equal(call.status, 'ringing');
  assert.throws(() => service.get(call.callId, 'caller'), { statusCode: 403 });
  assert.equal(service.start('caller', 'callee', 'video', () => {}).status, 'ringing');
});

test('accepting a call cancels the missed-call timeout', async () => {
  const service = new CallService(10);
  let missed = false;
  const call = service.start('caller', 'callee', 'video', () => { missed = true; });

  service.accept(call.callId, 'callee');
  await new Promise((resolve) => setTimeout(resolve, 25));

  assert.equal(missed, false);
  assert.equal(service.get(call.callId, 'caller').status, 'accepted');
  service.finish(call.callId);
});

test('callee disconnect immediately ends a ringing call and cancels its timeout', async () => {
  const service = new CallService(50);
  let missed = false;
  const call = service.start('caller', 'callee', 'voice', () => { missed = true; });

  assert.equal(service.finishForUser('callee'), call);
  assert.throws(() => service.get(call.callId, 'caller'), { statusCode: 403 });
  await new Promise((resolve) => setTimeout(resolve, 60));
  assert.equal(missed, false);
  assert.equal(service.start('caller', 'callee', 'video', () => {}).status, 'ringing');
});
