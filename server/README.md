# Bear Buddy API

Standalone TypeScript/Express API for the Expo client. MongoDB Atlas stores account profiles and meal entries. The service does not store calories, weight, or medical diagnoses; meal notes are optional and should not contain sensitive health details.

## Local setup

1. Create a MongoDB Atlas database and allow the development machine's IP in the Atlas network access list.
2. Copy `.env.example` to `.env` and set `MONGODB_URI` and a unique random `JWT_SECRET` of at least 32 characters. Meal reminders are scheduled locally on the device after notification permission is granted; the app cannot override Do Not Disturb or Focus settings.
	If the network's DNS resolver refuses MongoDB SRV lookups, set `MONGODB_DNS_SERVERS=1.1.1.1,8.8.8.8`; verify that your network permits direct DNS queries to those resolvers.
3. Optional, for password-reset emails: set `BREVO_API_KEY` (Brevo, HTTP API; free plan) or `SMTP_URL` (any SMTP server, for example `smtps://user:pass@smtp.example.com`), plus `MAIL_FROM` such as `Bear Care <you@example.com>`. With Brevo, `MAIL_FROM` must be a sender you have verified in Brevo (Senders, Domains & Dedicated IPs). Without either, outside production, reset messages are written to `server/.dev-outbox/` (git-ignored) so you can copy the code during development; in production nothing is sent.
4. Run `npm install` and `npm run dev` from this directory.
5. The API listens on `http://localhost:3000`; `GET /health` is available without a database-backed user session after startup.

For a production deployment, use a managed Node host, set the same environment variables in its secret manager, restrict `ALLOWED_ORIGINS` to the deployed web client origins, and keep Atlas network access limited to the host. Native Android/iOS clients do not send browser origins, so CORS is only a browser restriction, not an API authentication mechanism.

## Mobile network access

**Testing on a shared network needs no configuration.** Run the API (`npm run dev` in `server/`) and Expo (`npx expo start --lan` in `mobile/`) on the same computer and put the phone on the same Wi-Fi (or share the computer's hotspot). In development the app looks for the API on the same host that serves the app: the page's address on web, the Expo dev server's address in Expo Go, always on port 3000. When the computer's address changes, restart nothing: reload the app. The API accepts browsers loaded from any host's Expo web port (8081/19006) outside production. If it still cannot connect, check that the computer's firewall allows Node.js on private/public networks, that the network does not isolate devices from each other, and use Connection settings (or "Use automatic address" to clear a saved one) as an override. Expo tunnel mode serves only the bundler, so the app falls back to `EXPO_PUBLIC_API_URL` or the saved address.

The mobile app can save a server URL from **Connection settings** on the sign-in/create-account screen or from **Settings → Server connection**. Enter either the API root (for example, `https://api.example.com`) or the full API base (`https://api.example.com/api`); the app checks `/health` before saving. The saved address is used for all subsequent mobile API requests and takes precedence over `EXPO_PUBLIC_API_URL`.

For access across changing public and private Wi-Fi or cellular networks, deploy the API behind a stable DNS name with HTTPS on port 443. This avoids depending on a developer machine's changing LAN address, and is generally more compatible with guest Wi-Fi and carrier networks. For a server intentionally kept private, connect the phone to that network or its VPN and enter its reachable private address instead; private LAN addresses are not reachable from unrelated networks. Do not expose the API over plain HTTP on public networks.

`EXPO_PUBLIC_API_URL` is a build-time default for development or distribution. Set it to the stable HTTPS API base before building, or leave the default and configure the address in the app. To test a local server from a physical device, use the development computer's current LAN address and ensure the device and computer can reach each other; `localhost` and Android's `10.0.2.2` are only for local/emulator development.

## API contract

All error responses use `{ "error": { "code": "...", "message": "..." } }`. Protected endpoints require `Authorization: Bearer <accessToken>`. Access tokens expire according to `JWT_EXPIRES_IN` (30 days by default). The app calls `POST /api/auth/refresh` whenever it opens with a stored sign-in; it returns the profile and a fresh token, so people stay signed in as long as they keep using the app, until they log out.

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/health` | Service health |
| `POST` | `/api/auth/register` | Create account; accepts `email`, `password`, `displayName`, optional IANA `timezone` |
| `POST` | `/api/auth/login` | Sign in with `email` and `password` |
| `POST` | `/api/auth/password-reset/request` | Ask for a reset code by email; always answers `202` with the same message |
| `POST` | `/api/auth/password-reset/confirm` | Set a new password with `token` and `password`; the code works once for 30 minutes (`204`, or `400 INVALID_RESET_TOKEN`) |
| `POST` | `/api/auth/refresh` | Confirm the stored sign-in is still valid; returns the profile and a fresh token |
| `GET` | `/api/auth/me` | Return the signed-in profile |
| `DELETE` | `/api/auth/me` | Delete the signed-in profile and meal entries |
| `GET` | `/api/profile` | Read profile and daily meal goal |
| `PATCH` | `/api/profile` | Update `displayName`, `timezone`, `dailyMealGoal`, `notificationsEnabled`, and/or `reminderTimes` |
| `GET` | `/api/meals` | List up to 100 entries; optional ISO `from`, `to`, and `limit` query parameters |
| `POST` | `/api/meals` | Create entry with `name`, `mealType`, ISO `eatenAt`, optional `notes` |
| `PATCH` | `/api/meals/:mealId` | Update an owned entry, including its name |
| `DELETE` | `/api/meals/:mealId` | Delete an owned entry |
| `GET` | `/api/progress` | Return today's count, goal status, current streak, and the last seven days |

Meal types are `breakfast`, `lunch`, `dinner`, and `snack`. Progress days use the profile's IANA timezone. A day counts toward a streak when it meets the user's configurable meal goal; an unfinished current day does not break the streak until that day ends.

## Checks

Run `npm test`, `npm run typecheck`, and `npm run build` from this directory.

## Load test

`scripts/load-test.mjs` runs 25 isolated test users (12 ordinary requests a minute each, 5 minutes by default) against a running API and
reports failures, latency percentiles and whether any user ever saw another user's data. It creates its users directly in the test
database and deletes them afterwards, and refuses to run unless the database name starts with `bear_buddy_test`. Start a separate API
instance against that database (`PORT=3100 MONGODB_URI=<test database> node dist/index.js`), then run
`TEST_MONGODB_URI=<test database> JWT_SECRET=<same secret> API_URL=http://localhost:3100 node scripts/load-test.mjs`.
