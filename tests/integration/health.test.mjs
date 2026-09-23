import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { networkInterfaces } from 'node:os';
import { createServer } from 'node:net';
import { setTimeout as delay } from 'node:timers/promises';
import test from 'node:test';
import WebSocket from 'ws';

async function unusedPort() {
  const server = createServer();
  await new Promise((resolve, reject) => server.once('error', reject).listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  await new Promise((resolve) => server.close(resolve));
  return port;
}

async function waitFor(url, child) {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    if (child.exitCode !== null) throw new Error(`Server exited early with code ${child.exitCode}`);
    try {
      const response = await fetch(url);
      if (response.status >= 200) return response;
    } catch { /* Wait for the server to finish starting. */ }
    await delay(200);
  }
  throw new Error(`Server did not become ready at ${url}`);
}

test('backend health API and LAN binding respond through the frontend proxy', async (t) => {
  const backendPort = await unusedPort();
  const frontendPort = await unusedPort();
  const env = { ...process.env, HOST: '0.0.0.0', PORT: String(backendPort), FRONTEND_PORT: String(frontendPort) };
  const backend = spawn(process.execPath, ['--watch', 'backend/dist/main.js'], { env, stdio: 'ignore' });
  const frontend = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--config', 'frontend/vite.config.ts', '--host', '127.0.0.1', '--port', String(frontendPort), '--strictPort'], { env, stdio: 'ignore' });
  t.after(() => { backend.kill(); frontend.kill(); });

  const page = await waitFor(`http://127.0.0.1:${frontendPort}/`, frontend);
  const html = await page.text();
  assert.match(html, /<div id="root"><\/div>/);
  assert.match(html, /\/src\/main\.tsx/);

  const direct = await waitFor(`http://127.0.0.1:${backendPort}/api/health`, backend);
  const directBody = await direct.json();
  assert.equal(directBody.service, 'LAN-Media Backend');
  assert.ok(['ok', 'degraded'].includes(directBody.status));
  assert.ok(['connected', 'disconnected'].includes(directBody.database));
  assert.equal(direct.status, directBody.database === 'connected' ? 200 : 503);

  const viaProxy = await fetch(`http://127.0.0.1:${frontendPort}/api/health`);
  const proxyBody = await viaProxy.text();
  assert.equal(viaProxy.status, direct.status, proxyBody);
  assert.deepEqual(JSON.parse(proxyBody), directBody);

  const realtime = new WebSocket(`ws://127.0.0.1:${frontendPort}/ws`);
  const realtimeCloseCode = await new Promise((resolve, reject) => {
    realtime.once('close', code => resolve(code));
    realtime.once('error', reject);
  });
  assert.equal(realtimeCloseCode, 4401, 'Vite should proxy WebSocket upgrades to the authenticated backend endpoint.');

  const meWithoutSession = await fetch(`http://127.0.0.1:${backendPort}/api/auth/me`);
  assert.equal(meWithoutSession.status, 401);

  const notFound = await fetch(`http://127.0.0.1:${backendPort}/api/not-found`);
  assert.equal(notFound.status, 404);
  assert.deepEqual(await notFound.json(), { error: { message: 'Route not found.' } });

  const lanAddresses = Object.values(networkInterfaces()).flatMap((addresses) => addresses ?? [])
    .filter((address) => address.family === 'IPv4' && !address.internal);
  if (lanAddresses.length > 0) {
    const lanResponse = await waitFor(`http://${lanAddresses[0].address}:${backendPort}/api/health`, backend);
    assert.equal(lanResponse.status, direct.status);
  }
});
