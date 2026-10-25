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

### User Story 1 slice 3 record (T026-T027)

- 2026-10-24: password reset (request/confirm, hashed single-use 30-minute code, mailer with SMTP or development
  outbox), meal-target field without the 1-8 ceiling, automatic API address in development. API 44/44 (database-backed
  tests against `bear_buddy_test`), API typecheck and build passed, mobile 25/25 and typecheck passed. Walked through in a
  headless Edge browser against the real API: forgot password -> code from the outbox -> new password -> sign in; a meal
  target of 312 saved. Expo Go on a phone not yet verified.
- User Story 1 checkpoint: registration, sign-in, profile, timezone-aware meal history, past-meal entry, duplicate
  email rejection, account deletion and recovery pass their tests.

### User Story 2 slice 1 record (T028-T033)

- 2026-10-25: tests first (5 failed as expected), then code. API 59/59 against `bear_buddy_test`, API typecheck and build
  passed; mobile 46/46 and typecheck passed. Reminder times are 1-8 distinct HH:mm values stored in time order; a timezone
  change leaves them untouched (they are device wall-clock times). Home toggle and settings switch share
  `setRemindersEnabled`; reminders show as on only when the device schedule and the saved preference both succeeded.
- Checked in a headless browser: on web both toggles explain that reminders need the phone app and stay off; times can be
  added, removed and saved. **Not yet checked on a device**: permission grant/denial, scheduled notifications firing, Do Not
  Disturb behavior (needs a development build; Expo Go cannot schedule notifications) - this is T035.

### Notification review and actions record (T034, 2026-10-25)

- Review found and fixed: no foreground handler, reminders wrongly blocked in Expo Go, silent low-priority Android channel,
  taps ignored, no interactive action. Added the "Log a meal" text action (saved once, remembered across restarts, token in
  secure storage). `npm audit fix` + vitest 5: server 0 vulnerabilities, mobile 5 remaining inside Expo's CLI (no patch
  available). Mobile 57/57 tests and typecheck, server 59/59; iOS, Android and web bundles build. **Not yet run on a phone**:
  see `notifications-setup.md` for the steps and what to record.

## Increment 2 validation (User Story 4)

Run on a phone in Expo Go and on a desktop browser. Record device, date and result under each step.

1. **Opens in Expo Go**: Android and iPhone open the app with no `ExpoTopicSubscriptionModule` or other red-box error.
2. **Smooth breathing** (SC-023): watch the idle bear for one minute; no visible stutter. In a browser, record frame
   times from the performance panel for one minute (none above 33 ms).
3. **Animate switch**: with the device set to reduce motion, switch on shows idle animations; switch off stops them;
   tapping the bear still reacts.
4. **Log out** (SC-024): from settings, press "Log out"; the sign-in screen appears; signing in again shows the same data.
5. **Timezone**: settings have no timezone field. Change the device timezone, reopen the app: meal times and the day
   change follow it; an old meal keeps its moment.
6. **Reminder blocks** (SC-025): with meal targets 1, 3, 5, 8 and 12 the number of blocks matches; times are 24-hour,
   ordered and different; changing the target adds or removes blocks and keeps edited times.
7. **Goal bar** (SC-026): log k meals for k = 0..target; the bar shows k/target and fills proportionally; reopen the app
   and delete a meal; it follows. Repeat for an account whose timezone differs from UTC, around midnight.
8. **Password notice** (SC-027): registration shows the safekeeping note and quip; sign-in has no "forgot password";
   settings have no timezone.
9. **Reminder note** (SC-028): both reminder switches stay off and show the "still being figured out" note.
10. **App icon**: the home-screen icon (installed build) and the browser tab show the bear's head.
11. **Backend removal** (FR-069): `backend/` is gone; server tests/build, mobile tests and typecheck all pass.

### Increment 2 record (T063-T083, 2026-10-25)

- Automated: API 84 tests (database-backed ones against `bear_buddy_test`), API typecheck and build passed; mobile
  tests and typecheck passed; `expo-doctor` 20/20.
- Walked through in headless Edge against the real API: no "forgot password" and a password-safekeeping notice on
  registration; account timezone set from the device on sign-in; no timezone field; reminder blocks 5, 2, 12 for targets
  5, 2, 40; animate switch off stops idle animation; goal bar 2/3 at 67 %; log out returns to sign-in with no data.
- Smooth breathing (SC-023): over 20 s in headless Edge, p99 frame time 26 ms, 1 frame over 33 ms, no long tasks; DOM
  updates about 46 a second (the body part only). Needs a look by eye on a real browser and a phone.
- **Still to do on devices (T084)**: Expo Go on Android and iPhone opens without the missing-module error; icon shown on an
  installed build; breathing looks smooth by eye; timezone change on a phone; goal bar on a phone.

### Stay signed in record (T085-T087, 2026-10-25)

- Server 87 tests, mobile 84 tests, typechecks passed. In headless Edge against the real API: registered, reloaded
  (still signed in); blocked the API on launch (connection message, token kept, "Try again" signed in); logged out and
  reloaded (sign-in screen); deleted the account elsewhere and reloaded (sign-in screen, stale token discarded).
- **Not yet checked on a phone** (T088): close and reopen in Expo Go, airplane mode on launch, log out then relaunch.

### Phase 5 slice 1 record (T036, T037, T040-T044, 2026-10-25)

- Tests first (energy arithmetic, activity validation/ownership/progress); server 111 tests against `bear_buddy_test`, typecheck
  and build passed; mobile 90 tests and typecheck passed.
- In headless Edge against the real API: no steps entered shows "No steps entered today" with 0/30 energy; setting a step target
  of 5,000 without steps still shows none; logging 5,600 steps shows "5,600 / 5,000 steps - target reached" and 25/30 energy
  (5 full intervals x 5); deleting the entry returns to "No steps entered today" and 0/30.
- Not yet checked on a phone. Sudoku energy cost, rewards and the streak/health rules are later slices.

### Phase 5 slice 2 record (T038, T045-T047, 2026-10-25)

- Server 128 tests and mobile 107 tests passed, typechecks and the server build passed, iOS/Android/web bundles compile.
- Streak (option 2) and bear health covered by `server/tests/streak.test.ts`; Sudoku rules by `mobile/src/services/sudoku.test.ts`
  (generation with a unique solution, muted digits only when in all nine boxes, red clashes, win and incorrect results);
  start/resume/retry safety by `mobile/src/services/sudokuGame.test.ts`; energy cost and rewards by `server/tests/sudoku.test.ts`,
  including the spec example (five meals for a five-meal target: 100% then 90% after one game start).
- In headless Edge against the real API: started a game (81 cells, 36 clues, about 150 ms to generate and start), reloaded and
  resumed it, filled it with one wrong digit (not-quite message), corrected it (solved, +10 reward points), energy -5 after the
  game and 10 reward points on the server.
- Not yet checked on a phone (puzzle generation speed and touch size of the grid and number pad).

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
