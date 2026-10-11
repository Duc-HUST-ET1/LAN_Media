import assert from 'node:assert/strict';
import test from 'node:test';
import { isDiscoveryRequest } from '../../backend/dist/services/NetworkDiscoveryService.js';

test('accepts only the version 1 LAN-Media discovery request',()=>{
  assert.equal(isDiscoveryRequest(Buffer.from(JSON.stringify({service:'lan-media',version:1,type:'discover'}))),true);
  assert.equal(isDiscoveryRequest(Buffer.from(JSON.stringify({service:'other',version:1,type:'discover'}))),false);
  assert.equal(isDiscoveryRequest(Buffer.from(JSON.stringify({service:'lan-media',version:2,type:'discover'}))),false);
});
test('rejects malformed and oversized UDP discovery packets',()=>{
  assert.equal(isDiscoveryRequest(Buffer.from('{broken')),false);
  assert.equal(isDiscoveryRequest(Buffer.from('x'.repeat(257))),false);
});
