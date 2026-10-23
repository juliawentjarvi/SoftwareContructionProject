# Quickstart Validation: Bear Care

Run package commands from their named directories. Use a dedicated test database and test
accounts; never point automated tests at production or personal data.

## Prerequisites

- Node.js LTS and npm; dependencies installed in `server/` and `mobile/`.
- A dedicated development/test MongoDB database for persistence and multi-user tests.
- Set `TEST_MONGODB_URI` only for database-backed tests, using a database named
  `bear_buddy_test` or prefixed `bear_buddy_test_`. The test suite refuses other database names.
  Keep `server/.env` and its normal `MONGODB_URI` separate from test configuration.
- `server/.env` with a unique `JWT_SECRET` of at least 32 characters.
  Do not commit environment files or use production secrets.
- Expo Go on a supported test device, or an emulator/browser. Some notification features require a
  development build and are not expected to work in Expo Go.

## Phase 0: Baseline checks (before product features)

From `server/`:

```powershell
npm test
npm run typecheck
npm run build
```

From `mobile/`:

```powershell
npm test
npm run typecheck
```

Expected: all API tests run and pass, API typecheck/build succeed, and the mobile typecheck
passes. Mobile API tests use mocked storage/network and do not need a live backend. Health,
validation, authentication-boundary, and contract tests do not require a database. Ownership tests
are skipped unless `TEST_MONGODB_URI` explicitly names the dedicated test database; created test
users and their records are cleaned up after each test.

### Stabilization run record

- 2026-10-23 baseline: mobile typecheck passed. API tests, typecheck, and build were blocked before
  execution because `server/tsconfig.json` extended the unavailable `expo/tsconfig.base`.
- After removing the Expo-only inheritance: API tests passed (15 passed, including the database-backed
  ownership test), API typecheck and build passed; mobile API tests passed (7 passed) and mobile
  typecheck passed.
- Created the isolated `bear_buddy_test` database on the configured Atlas cluster using the
  existing database user's credentials. The authenticated API-style connection succeeded, and
  creating its setup collection confirmed that this account has sufficient create/write permission.
- The ownership integration test passed against `bear_buddy_test` with two unique users. It verifies
  list/read/update/delete isolation and test-record cleanup. The test helper now applies the same
  configured DNS resolver override as the API startup path.
- The Phase 2 automated stabilization gate now passes locally. Physical-device Expo Go and
  different-network reachability remain unverified manual checks.
- The Expo Go device flow and different-network reachability were not manually exercised during
  this run; they still require a reachable API and a physical device/network.
- Existing client/API routes align for registration, login, profile, meals, deletion, and progress.
  Client forms retain entered credentials/meal data on returned request failures. Request timeouts
  and malformed successful responses now produce explicit failures, and interrupted writes are
  not automatically retried.

### User Story 1 slice 1 record (T017-T022)

- 2026-10-23: tests written first; 5 new tests failed as expected (meal target above 8, email and timezone
  normalization in the schemas, `GET /api/meals/:id`, case-insensitive sign-in). After the fixes: API 35/35 passed
  against `bear_buddy_test` (TEST_MONGODB_URI derived from the configured cluster, not stored), API typecheck and
  build passed, mobile 15/15 passed and typecheck passed. Auth routes are rate limited per app instance, so each
  auth test builds its own app.

### User Story 1 slice 2 record (T023-T025)

- 2026-10-23: new `mobile/src/services/time.test.ts` (6 tests) and `server/tests/account-deletion.test.ts` (1 test). Final
  results: API 36/36 (database-backed tests against `bear_buddy_test`), API typecheck passed, mobile 21/21, mobile
  typecheck passed. Not yet manually checked: the seven-second prompt and in-page deletion confirmation in Expo Go and a
  desktop browser. `Alert.alert` does nothing on the web, so deletion confirmation is now rendered in the page.
- Registration now sends the device timezone (previously every account defaulted to UTC).

## API reachability and endpoint switching

1. Start the API from `server/` using `npm run dev`; verify `GET /health`.
2. Start the client from `mobile/` using `npm start`.
3. On an emulator, use its supported development host address. On a physical device, do not use
   `localhost` or an emulator-only alias; use a currently reachable development-machine LAN/VPN
   address or a stable HTTPS service.
4. Configure endpoint A in Connection settings and verify health and sign-in.
5. Configure a second reachable endpoint B and verify new requests use B without rebuilding the
   client.
6. Enter an invalid or unreachable endpoint, wait for its health check to fail, and verify endpoint
   A or B remains saved. Verify an explicit, recoverable failure message.

## Changing and unreliable internet connections

1. Deploy a test API at a stable HTTPS hostname with a valid certificate for tests across networks.
2. Configure the same client on Wi-Fi and cellular/another permitted network. Verify health,
   sign-in, and meal retrieval on each reachable network.
3. Disable connectivity or use an unreachable test endpoint. Verify the client reports a timeout
   or reachability error and preserves entered form data where applicable.
4. Restore connectivity and retry a read. Verify recovery without restarting the app.
5. For a write whose result is uncertain after a connection interruption, inspect the log before
   retrying; verify the client does not falsely show success or create a duplicate automatically.
6. Document network restrictions when a service is intentionally private. A private LAN address
   is not expected to work from an unrelated network.

## Two-user isolation

1. Create two unique test accounts, A and B, with distinct credentials and emails.
2. As A, create a meal and, when implemented, an activity entry. Record their IDs.
3. As B, verify A's entries do not appear in lists.
4. With B's valid token and A's known IDs, attempt to read/update/delete A's entries. Verify no
   private data is returned and no record changes.
5. Repeat without a token and verify protected routes reject the request.
6. Verify duplicate registration is rejected after email normalization.
7. Delete the test users and records in cleanup, even if an assertion fails.

## Concurrent sessions and conflict resolution

1. Open the same profile or mutable record in two authenticated sessions for one test account.
2. Update and save it from session A.
3. Submit an edit to that same field from session B using the value it loaded before A saved.
4. Verify B receives a recoverable conflict, A's latest value remains stored, and B can refresh
   before applying its change.
5. Concurrently update different fields on the profile and different records from the sessions;
   verify all non-conflicting changes persist.
6. Repeat with two different accounts and verify ownership isolation remains intact.

## Performance targets

Run measurements on at least one representative mid-range physical mobile device and one
supported desktop browser. Record device/runtime, app version, server deployment, network,
workload, date, and measured results.

- Measure 20 launches per device/runtime; at least 19 must reach a usable main screen within
  3 seconds.
- Measure common interactions and transitions; at least 95% must show feedback within 100 ms and
  complete within 300 ms, respectively, excluding network waits for transitions.
- On a stable test network with round-trip latency up to 100 ms and packet loss below 1%, run the
  API for five minutes with 25 concurrent test users making up to 12 ordinary requests per minute
  each. Record client-measured p50, p95, and p99 response times and request failure rate. At least
  95% of ordinary requests must complete within 1 second; verify no cross-user reads or unintended
  overwrites.
- Run a 30-minute normal-use/error-recovery session with at least 500 screen transitions and
  repeated slow, interrupted, and unavailable network cases. Verify zero reproducible crashes and
  record memory use after warm-up, including whether a sustained upward trend appears.
- Do not claim production capacity beyond this workload. If a target is missed, record the
  conditions and measured bottleneck before optimization, then rerun the same scenario.

## Expo Go integration

1. Open the app in Expo Go, connect it to the API at an address reachable from that device, and
   register a non-production test account.
2. Sign out and sign in as a second test account. Confirm the sessions and meal histories do not
   mix.
3. Add a meal, view it in the log, and verify the selected time and timezone display.
4. Change the API endpoint or network and verify failure/recovery behavior without losing the
   account's other data.
5. Disconnect during a read and a write. Confirm failures are not shown as success, entered values
   remain available where applicable, cached data is marked stale with its last refresh time, and
   writes are not silently queued.
6. Try reminders only if Expo Go on the chosen platform supports the exact notification behavior.
   Record unsupported notification actions as a runtime limitation and validate them in a
   development/native build instead.
7. Complete the core supported flows on both emulator and physical device where available.

## Feature iteration

For each implemented requirement, run its automated acceptance checks and the relevant smoke flow.
When behavior differs from the spec, record:

- Specified expectation and the exact requirement.
- Observed result and reproducible steps.
- Device, network, account setup, and relevant logs/errors.
- Decision: implementation defect or specification defect/omission, with rationale.
- Fix or `/speckit-specify` update, followed by targeted regression checks.

See [the API contract](contracts/api-contract.md), [the data model](data-model.md), and the
[feature specification](spec.md) for expected behaviors.
