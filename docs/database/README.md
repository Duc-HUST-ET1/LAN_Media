# MySQL setup

The backend uses MySQL 8.0+ and applies the versioned schema migration in `backend/src/core/database/migrations/` when it starts. Migrations create `users`, `sessions`, `devices`, `conversations`, `conversation_members`, `messages`, `files`, and `calls`. Migration 003 adds active conversation and message references to file metadata and allows `FILE` message rows; it is additive and preserves existing rows.

## Option A: existing host MySQL

1. Make sure the MySQL service is running.
2. Update `.env` with the database host, user, and password you intend to use.
3. In a MySQL administrator shell, run `docs/database/setup.sql`. If you change the sample database user/password in `.env`, update the corresponding values in that SQL script too. The sample password is for local development only.
4. Start the app with `npm run dev`. The backend applies pending migrations automatically.

Example:

```powershell
Get-Content docs/database/setup.sql | mysql -u root -p
```

## Option B: Docker Compose

After installing Docker Desktop, run `docker compose up --build`. MySQL is published on port 3307 by default so it can coexist with a host MySQL service on 3306. The app container connects to the Compose MySQL service over its private network. Set `DB_PASSWORD` and `DB_ROOT_PASSWORD` in `.env` to private values before using Compose beyond local development.

## Inspect registered users

```sql
USE lan_media;
SELECT id, username, email, display_name, role, created_at FROM users;
```

Do not select or expose `password_hash` in application UI. Password hashes use scrypt; authentication tokens are random opaque values in an HttpOnly cookie, while only their SHA-256 hashes are stored in `sessions`.
