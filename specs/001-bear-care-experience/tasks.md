---

description: "Executable tasks for stabilizing and delivering the Bear Care experience"
---

# Tasks: Bear Care Wellness Experience

**Input**: Design documents from `/specs/001-bear-care-experience/`

**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `contracts/api-contract.md`,
and `quickstart.md`

**Tests**: Included because the user explicitly requested testing existing behavior, separate user
isolation, network failure/recovery checks, integration testing in Expo Go, and measurable
verification.

**Execution constraint**: Complete Phase 1 and Phase 2, including their exit checks, before any
user-story feature implementation. Phase 1 repairs and verifies existing behavior only; do not add
product functions during that phase. Later story tasks describe follow-on work from the spec and
must not be pulled into Phase 1.

## Phase 1: Setup and Baseline Capture

**Purpose**: Confirm the active client/API path and record current behavior before changing code.

- [X] T001 Confirm `mobile/` uses the documented `server/` API by comparing `mobile/src/services/api.ts`, `server/README.md`, and `server/src/app.ts`; record route mismatches and leave `backend/` unchanged pending ownership confirmation.
- [X] T002 [P] Run `npm run typecheck` from `mobile/` and record the baseline result for `mobile/package.json` and `mobile/tsconfig.json`.
- [X] T003 [P] Run `npm test`, `npm run typecheck`, and `npm run build` from `server/`; record the configuration failure and commands in `specs/001-bear-care-experience/quickstart.md`.
- [X] T004 [P] Inventory existing login, registration, meal, profile/settings, API URL selection, and notification behavior in `mobile/app/`, `mobile/src/services/`, `server/src/`, and `server/tests/`; record observed behavior against `specs/001-bear-care-experience/spec.md` without changing product behavior.

---

## Phase 2: Foundational Stabilization (Blocking)

**Purpose**: Restore dependable API validation and safe test infrastructure before any user-story work.

- [X] T005 Remove the Expo-only `extends` entry from `server/tsconfig.json` and retain strict Node.js TypeScript settings so `server/` typechecks without resolving mobile dependencies.
- [X] T006 Configure Vitest in `server/vite.config.ts` or `server/vitest.config.ts` to use the API TypeScript configuration rather than attempting to load Expo configuration from `server/tsconfig.json`; verified Vitest automatically uses the API package TypeScript config once the Expo-only inheritance was removed, so no redundant config file was added.
- [X] T007 Run `npm run typecheck` and `npm run build` from `server/`; fix only failures caused by making the API package independently compilable in `server/src/`.
- [X] T008 Add unique, per-test user identities and cleanup in `server/tests/test-helpers.ts`; ensure helpers never use production credentials or fixed shared account records.
- [X] T009 Add API regression tests in `server/tests/app.test.ts` for health, invalid login validation, missing bearer-token rejection, and the existing error response envelope without requiring a production database.
- [X] T010 Add isolated multi-user authorization tests in `server/tests/ownership.test.ts`; create two distinct accounts and verify user B cannot list, read, update, or delete user A's known meal records. Verified against the dedicated `bear_buddy_test` database.
- [X] T011 Add database-test safety checks in `server/tests/test-helpers.ts` so persistence tests require an explicitly configured test database and fail before connecting if the configured database is production or personal development data.
- [X] T012 Add API URL normalization and switching tests in `mobile/src/services/api.test.ts`; verify root URLs and `/api` URLs normalize correctly and a failed health check does not replace the last saved working endpoint.
- [X] T013 Add network failure tests in `mobile/src/services/api.test.ts` for malformed URL, unavailable host, timeout, interrupted request, and recovered request; verify failed requests remain failures and no write is silently replayed.
- [X] T014 Fix confirmed request error and form-state bugs in `mobile/src/services/api.ts`, `mobile/app/login.tsx`, `mobile/app/register.tsx`, `mobile/app/meals.tsx`, and `mobile/app/settings.tsx`; preserve current features and input on recoverable network failure.
- [X] T015 Verify API-base configuration in `mobile/.env.example`, `mobile/src/services/api.ts`, and `server/README.md`; document emulator-only addresses, physical-device LAN/VPN reachability, stable HTTPS use across networks, and the fact that CORS is not API authentication.
- [X] T016 Run all API tests, API typecheck/build, and mobile typecheck from their respective package folders; record commands and results in `specs/001-bear-care-experience/quickstart.md`.

**Checkpoint**: No new product functions have been added. API tests, typecheck, and build pass;
mobile typecheck passes; two-user isolation checks pass; endpoint switching and network failure
recovery checks pass. Any unmet baseline condition is recorded rather than marked complete.

---

## Phase 3: User Story 1 - Set Up an Account and Log Meals (Priority: P1)

**Goal**: Provide reliable existing registration, login, profile, and meal-log flows with private
user data. Complete this phase only after the Phase 2 stabilization checkpoint.

**Independent Test**: Register two unique users, sign in separately, set a meal target above eight
for one user, add a meal with a past time and notes, verify the meal displays in the selected
timezone, and verify neither user can view or change the other's data.

### Tests for User Story 1

- [X] T017 [P] [US1] Add registration and login tests in `server/tests/auth.test.ts` for normalized-email uniqueness, invalid input, valid sign-in, and rejection of duplicate accounts.
- [X] T018 [P] [US1] Add meal ownership and validation tests in `server/tests/meals.test.ts` for non-empty bounded names, meal type, optional bounded notes, timezone-aware timestamps, and cross-user read/update/delete rejection.
- [X] T019 [P] [US1] Add mobile API result tests in `mobile/src/services/api.test.ts` proving failed registration/login/meal writes do not show success and preserve entered form values.

### Implementation for User Story 1

- [X] T020 [US1] Normalize email consistently and enforce unique registration in `server/src/validation.ts`, `server/src/app.ts`, and `server/src/models/user.ts`; preserve the existing `{ "error": { "code": "...", "message": "..." } }` error envelope.
- [X] T021 [US1] Align the profile and meal constraints in `server/src/validation.ts` and `server/src/models/user.ts` with `specs/001-bear-care-experience/data-model.md`, including a positive whole-number meal target with no fixed 1–8 ceiling and a valid IANA timezone.
- [X] T022 [US1] Verify every meal read, update, and delete in `server/src/app.ts` scopes by both meal ID and authenticated user ID; return no other user's data when a valid foreign meal ID is supplied.
- [X] T023 [US1] Implement local date/time entry and timezone display for meal creation and history in `mobile/app/meals.tsx` and `mobile/src/services/api.ts`; ensure the stored instant remains unchanged when the profile timezone changes.
- [X] T024 [US1] Implement the seven-second post-save offer to log another meal in `mobile/app/meals.tsx` and `mobile/app/index.tsx`; verify the saved meal persists before the prompt appears.
- [X] T025 [US1] Implement confirmed account deletion and signed-out navigation in `mobile/app/settings.tsx`, `mobile/app/index.tsx`, and `server/src/app.ts`; verify deletion removes or detaches the user's owned meals without affecting another account.
- [ ] T026 [US1] Implement generic password-reset request and single-use reset behavior in `server/src/validation.ts`, `server/src/app.ts`, `server/src/models/user.ts`, and `mobile/app/login.tsx`; never disclose account existence or return/log reset credentials.
- [ ] T027 [US1] Run `npm test`, `npm run typecheck`, and `npm run build` from `server/`, then `npm run typecheck` from `mobile/`; verify the independent User Story 1 test criteria.

**Checkpoint**: Registration, login, profile, timezone-aware meal history, past-meal entry, duplicate
email rejection, account deletion, and recovery behavior pass their specified tests without
cross-user data exposure.

---

## Phase 4: User Story 2 - Choose When to Be Reminded (Priority: P1)

**Goal**: Keep reminder settings consistent and make device permission, connectivity, and
platform capability visible to the user.

**Independent Test**: On a device/runtime supporting scheduled notifications, grant permission,
enable reminders, change times, verify the home and settings state agree, disable reminders, and
verify scheduled app notifications are cancelled. Also verify denied permission and offline error
states.

### Tests for User Story 2

- [ ] T028 [P] [US2] Add reminder preference validation tests in `server/tests/validation.test.ts` for valid times, invalid times, disabled state, timezone changes, and bounded reminder frequency.
- [ ] T029 [P] [US2] Add client reminder permission and schedule tests in `mobile/src/services/reminders.test.ts` for grant, denial, cancellation, rescheduling, and unsupported runtime behavior.
- [ ] T030 [P] [US2] Add mobile connection/reminder integration tests in `mobile/app/settings.test.tsx` and `mobile/app/index.test.tsx` proving both toggles reflect one saved setting and failures are not reported as active reminders.

### Implementation for User Story 2

- [ ] T031 [US2] Make backend reminder fields and schedule validation consistent in `server/src/validation.ts`, `server/src/app.ts`, and `server/src/models/user.ts`; backend preference must not imply that device permission was granted.
- [ ] T032 [US2] Synchronize reminder toggles, permission requests, and settings-save states in `mobile/app/index.tsx`, `mobile/app/settings.tsx`, and `mobile/src/services/reminders.ts`.
- [ ] T033 [US2] Handle reminder scheduling and cancellation failures explicitly in `mobile/src/services/reminders.ts` and `mobile/app/settings.tsx`; show permission/runtime-specific explanations and never show reminders active unless scheduling succeeded.
- [ ] T034 [US2] Add supported notification-action meal logging in `mobile/src/services/reminders.ts`, `mobile/app/meals.tsx`, and `mobile/src/services/api.ts`; gate the action on platform support and prevent duplicate meal submission.
- [ ] T035 [US2] Run `server/tests/validation.test.ts`, `mobile/src/services/reminders.test.ts`, API tests/typecheck/build, and mobile typecheck; manually verify permission grant/denial and Do Not Disturb behavior on a supported device without claiming the app can bypass device controls.

**Checkpoint**: Home and settings reminder states agree; permission denial and schedule failures
remain explicit; unsupported notification actions are documented as platform limits rather than
reported as passing functionality.

---

## Phase 5: User Story 3 - Care for the Bear and Enjoy Rewards (Priority: P2)

**Goal**: Deliver activity progress, energy points, bear feedback, Sudoku validation, and rewards
after the P1 account and reminder flows work reliably.

**Independent Test**: For a five-meal target, log five meals with no steps and verify a full energy
bar; start Sudoku once and verify the bar falls to 90%; add 1,000 steps and verify +5 energy points.
Verify Sudoku conflict/highlighting/finish behavior and independent reward-point accounting.

### Tests for User Story 3

- [ ] T036 [P] [US3] Add activity and progress tests in `server/tests/activity.test.ts` and `server/tests/progress.test.ts` for owner isolation, local-day boundaries, missing step data, and positive targets.
- [ ] T037 [P] [US3] Add energy-point calculation tests in `server/tests/energy.test.ts` for +10 per meal, +5 per complete 1,000-step interval, −5 once per started game, negative balances, daily reset, and correction/deletion recalculation.
- [ ] T038 [P] [US3] Add Sudoku board rule tests in `mobile/src/services/sudoku.test.ts` for one digit per 3x3 box, duplicate conflicts in row/column/box, correct full-board win, incorrect full-board continuation, and one-time game charge.
- [ ] T039 [P] [US3] Add reward-ledger tests in `server/tests/rewards.test.ts` for non-negative balances, one award per game completion, one spend per unlock, and separation of energy points from reward points.

### Implementation for User Story 3

- [ ] T040 [US3] Add the activity entry model and validation in `server/src/models/activity-entry.ts` and `server/src/validation.ts`; require a bounded activity type, timezone-aware occurred-at instant, optional non-negative integer step count, and owner account ID.
- [ ] T041 [US3] Add authenticated activity list/create/update/delete routes in `server/src/app.ts`; scope every operation to authenticated owner and update the documented route table in `specs/001-bear-care-experience/contracts/api-contract.md`.
- [ ] T042 [US3] Implement editable step target and activity logging in `mobile/app/meals.tsx`, `mobile/app/settings.tsx`, and `mobile/src/services/api.ts`; display absent step data distinctly from zero and target met.
- [ ] T043 [US3] Implement daily energy-point calculations in `server/src/progress.ts` and `server/src/app.ts`: +10 per meal, +5 per complete 1,000 steps, −5 once per Sudoku game start; reset by the user's local date and recalculate after meal/step corrections or deletions.
- [ ] T044 [US3] Render the energy bar in `mobile/app/index.tsx` using a full target of 10 points per planned meal; clamp display to empty/full, display negative balances as empty, and distinguish energy points from reward points.
- [ ] T045 [US3] Implement daily goal streak and fictional bear-health presentation in `server/src/progress.ts` and `mobile/app/index.tsx`; only qualify streaks when both meal and step targets are met and lower playful health only after two completed missed-meal days.
- [ ] T046 [US3] Implement Sudoku gameplay and validation in `mobile/app/sudoku.tsx` and `mobile/src/services/sudoku.ts`; disable a digit only when it appears in all nine 3x3 boxes, mark row/column/box duplicates red, and allow correction after an incorrect full board.
- [ ] T047 [US3] Charge the Sudoku start once and award completion reward points idempotently in `server/src/app.ts`, `server/src/models/reward-ledger.ts`, and `mobile/src/services/sudoku.ts`; never double-charge on resume or duplicate completion.
- [ ] T048 [US3] Implement bear animation, point-funded treats/customization, background/music selection, and mute control in `mobile/app/index.tsx`, `mobile/app/settings.tsx`, and `mobile/src/services/api.ts`; keep mute independent of notifications.
- [ ] T049 [US3] Run `server/tests/activity.test.ts`, `server/tests/progress.test.ts`, `server/tests/energy.test.ts`, `server/tests/rewards.test.ts`, and `mobile/src/services/sudoku.test.ts`, plus all API/mobile checks; validate energy arithmetic, Sudoku completion, reward idempotency, and two-user ownership independently.

### Bear animation (added from the bear-movements specification update)

- [ ] T058 [US3] Add `mobile/assets/bear/bear.svg` as the bear artwork and a generator `mobile/scripts/generate-bear.mjs` that converts it to `mobile/src/components/bear/BearArt.generated.tsx`, keeping named groups (eyes, ears, arms, legs, hearts) addressable (FR-056).
- [ ] T059 [US3] Implement the animation engine and `Bear` component in `mobile/src/components/bear/` with tap reactions (arm wave, surprised eyebrows, arms over eyes), blinking, random ear waves, bored behaviors, feed jump-and-hearts, and reduced-motion handling (FR-024, FR-057–FR-061).
- [ ] T060 [US3] Replace the text bear in `mobile/app/index.tsx` with `Bear`; trigger the feed reaction when a meal is saved and a reaction when Sudoku is selected (FR-059, FR-060).
- [ ] T061 [P] [US3] Add engine tests in `mobile/src/components/bear/animation.test.ts` for pose blending, reaction replacement, and reduced-motion behavior.
- [ ] T062 [US3] Validate every bear behavior on a phone in Expo Go and in a desktop browser; record results in `specs/001-bear-care-experience/quickstart.md` (SC-021, SC-022).

**Checkpoint**: Energy values match the examples and formula; board validation handles every Sudoku
constraint; gameplay charges and rewards cannot duplicate; missing step information never grants
streak credit.

---

## Phase 6: Polish, Performance, and Cross-Cutting Verification

**Purpose**: Verify combined flows, responsiveness, stability, compatibility, and user setup.

- [ ] T050 [P] Measure 20 app launches on a representative physical mobile device and desktop browser; record whether at least 19 launches reach a usable screen within 3 seconds in `specs/001-bear-care-experience/quickstart.md`.
- [ ] T051 [P] Measure at least 100 common interactions and transitions per representative runtime; record whether at least 95% show feedback within 100 ms and 95% transition within 300 ms, excluding network waits, in `specs/001-bear-care-experience/quickstart.md`.
- [ ] T052 Run a five-minute API load test with 25 isolated concurrent test users and up to 12 ordinary requests per minute each; report client p50/p95/p99, request failures, cross-user isolation, and the test network conditions in `specs/001-bear-care-experience/quickstart.md`.
- [ ] T053 Run a 30-minute Expo Go and desktop normal-use/error-recovery session with at least 500 screen transitions; record crashes, memory after warm-up, network disruptions, device/runtime, and unsupported native capabilities in `specs/001-bear-care-experience/quickstart.md`.
- [ ] T054 Verify timeout, interrupted request, unavailable server, stale cached data labeling, no offline write queue, and explicit retry behavior in `mobile/src/services/api.ts`, `mobile/app/meals.tsx`, and `specs/001-bear-care-experience/quickstart.md`.
- [ ] T055 Verify same-field concurrent edit conflict and independent-field persistence in `server/src/app.ts`, `server/tests/concurrency.test.ts`, and `mobile/src/services/api.ts`; record expected conflict and refresh behavior.
- [ ] T056 Update the root `README.md` with separate API/mobile setup, Expo Go instructions, configuration for emulator and physical device, supported desktop launch, and safe HTTPS/network guidance.
- [ ] T057 Run the full `server/` test/typecheck/build suite and `mobile/` typecheck; complete the Expo Go validation scenarios in `specs/001-bear-care-experience/quickstart.md` and document any unmet target or specification adjustment.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: Begins immediately; captures current package health and behavior.
- **Phase 2 (Foundational stabilization)**: Depends on Phase 1. Blocks all story and new feature work.
- **Phase 3 (US1)**: Starts only after Phase 2 exit gate. Establishes account and meal data required
  by reminders/progress.
- **Phase 4 (US2)**: Starts after Phase 2; integrates with the account/profile established in US1.
- **Phase 5 (US3)**: Starts after Phase 2 and requires US1 for accounts/meals. Its streak and
  reminder-related display may also integrate with US2 settings.
- **Phase 6 (Polish)**: Depends on the applicable stories and the Phase 2 stabilization gate.

### User Story Dependencies

- **US1 (P1)**: Depends on Phase 2; independently demonstrates account and meal ownership.
- **US2 (P1)**: Depends on Phase 2 and the profile/auth contract from US1.
- **US3 (P2)**: Depends on Phase 2 and US1 meal/account data; may run in parallel with US2 only
  for isolated activity/Sudoku work, not for shared home-screen integration.

### Parallel Opportunities

- T002, T003, and T004 can run in parallel after T001's active API path is confirmed.
- T009 and T012/T013 cover separate server/client test files and can run in parallel after the
  test configuration is ready.
- In US1, T017 and T018 can run in parallel; T020/T021 changes must be coordinated because both
  affect validation/profile behavior.
- In US2, T028 and T029 can run in parallel; T031 is backend work and T032/T033 are client work
  that can proceed independently after the contracts are fixed.
- In US3, T036, T037, T038, and T039 target independent test files and can run in parallel.
- Performance measurement tasks T050–T053 can run in parallel after all flows under test are
  implemented and stable.

## Parallel Example: Stabilization

```text
After confirming the active API path:
Task: T002 mobile baseline typecheck
Task: T003 API baseline test/typecheck/build
Task: T004 existing-flow inventory

After API test configuration is repaired:
Task: T009 API boundary regressions
Task: T012 endpoint normalization/switching tests
Task: T013 network failure/recovery tests
```

## Parallel Example: User Story 3

```text
After Phase 2 and US1 are complete:
Task: T036 activity/progress tests
Task: T037 energy arithmetic tests
Task: T038 Sudoku validation tests
Task: T039 reward idempotency tests
```

## Implementation Strategy

1. **MVP now**: Phase 1 and Phase 2 only. Make the current app/API build, test, launch in Expo Go,
   and work reliably across users and reachable networks. Do not add new product functions until
   the Phase 2 checkpoint is met.
2. **Incremental feature delivery**: Implement US1, then US2, then US3 in priority order, keeping
   each phase independently testable and preserving existing behavior.
3. **Integrated verification**: Complete Phase 6 with real Expo Go, representative device/browser,
   network, concurrency, performance, and stability evidence.
4. **Specification feedback**: When observed behavior differs from the spec, record evidence and
   decide whether the implementation or the spec is wrong before changing either. If a requirement
   needs revision or extension, update the feature using `/speckit-specify` and refresh dependent
   plans/tasks before implementation.
