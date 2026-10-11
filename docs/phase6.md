# Phase 6: Server, devices and network status

The Settings > Network section polls authenticated network status every 30 seconds and lists devices/sessions. From the sign-in page, open **Server connection**, enter the server origin (for example `http://192.168.1.20:3000`), then test and save it. The URL must be an HTTP(S) origin without credentials, a path or query parameters. The app stores this URL and a random browser device identifier in local storage; authentication remains in the existing HttpOnly session cookie.

## Optional UDP discovery responder

```dotenv
DISCOVERY_ENABLED=false
DISCOVERY_PORT=30301
```

Set `DISCOVERY_ENABLED=true` to listen on UDP port 30301 (or your configured port). An IPv4 client sends `{"service":"lan-media","version":1,"type":"discover"}` and receives the service name, protocol version, HTTP port, `/ws` path and local IPv4 addresses. The responder ignores malformed packets, packets over 256 bytes and repeated requests from an address within 1.5 seconds. Permit the configured UDP port in the host firewall only on the trusted private LAN. Port conflicts and unavailable interfaces are logged; the HTTP application continues. Standard browsers cannot send UDP, so the web client uses manual URL configuration. A future native client can implement this protocol. UDP discovery does not cross routers/VLANs and may be blocked by Wi-Fi client isolation or host firewalls.

## APIs and data

- `GET /api/devices` lists devices owned by the authenticated user.
- `PATCH /api/devices/:deviceId` renames a device with JSON `{ "name": "..." }`.
- `DELETE /api/devices/:deviceId/session` revokes all active sessions for the owned device and closes matching WebSockets.
- `GET /api/network/status` reports server availability, database health, WebSocket service availability, listening port, local IPv4 addresses, uptime and timestamp. It does not disclose secrets.

Migration `004_device_session_schema` links existing device records to sessions and adds activity metadata without deleting existing application data. Device activity writes are throttled to once every five minutes per authenticated session. Online means an authenticated WebSocket is active for a device session. Last seen is updated on authenticated API activity. Network status describes server-side API/database health and measured API response time; it does not infer Wi-Fi signal, gateway or Internet health.

## Manual acceptance

1. Start MySQL and LAN-Media with `npm run dev` (or Docker Compose); note the backend `PORT` and allow it on the private LAN firewall.
2. Open the frontend. At sign-in, enter `http://<server-LAN-IP>:<PORT>` under **Server connection**.
3. Select **Test and save**; verify reachability and reload.
4. For native UDP discovery, enable the responder, allow `DISCOVERY_PORT/UDP`, and send the version 1 request above from a client on the same subnet. Standard browsers cannot perform this step.
5. Sign in, open Settings > Network and verify REST/API latency, database status, WebSocket status and the current device.
6. Sign in from a second browser/device and confirm both devices appear.
7. Revoke the second device's sessions. Confirm its WebSocket closes and `/api/auth/me` returns 401 on that client.
8. Stop the backend and confirm status polling reports disconnection; restart it and verify the frontend reconnects (WebSocket retry uses exponential backoff).
9. Verify chat, authentication, file transfer and calls with the two clients.

Two clients are needed for multi-session/revocation checks; UDP discovery additionally requires a native UDP-capable client on the same subnet. Discovery is not routed across VLANs and may be blocked by client isolation.
