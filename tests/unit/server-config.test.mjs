import assert from 'node:assert/strict';
import test from 'node:test';
import { validateServerUrl } from '../../frontend/src/api/ServerConfig.ts';

test('server URL accepts an HTTP(S) origin with a LAN address and port',()=>{
  assert.equal(validateServerUrl(' https://media.local:3443/ '),'https://media.local:3443');
  assert.equal(validateServerUrl('http://192.168.1.20:3000'),'http://192.168.1.20:3000');
});
test('server URL rejects malformed, unsafe and non-origin values',()=>{
  for(const value of ['','ftp://server.local','http://user:pass@server.local','http://server.local/api','http://server.local/?token=secret','http://0.0.0.0:3000']){
    assert.throws(()=>validateServerUrl(value));
  }
});
