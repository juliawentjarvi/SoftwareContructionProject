# Research: Bear Care Wellness Experience

## 1. Active Client/API Boundary

> **Update 2026-10-25**: `backend/` was verified as an unused stub and has been removed (section 20).

**Decision**: Treat `mobile/` and the documented `server/` API as the primary product path. Do
not expand or delete the separate `backend/` tree during stabilization until its ownership and
consumers are confirmed.

**Rationale**: `server/README.md` describes a standalone API for the Expo client, lists routes
that align with the mobile API service, and provides network/setup guidance. The alternate
`backend/` implementation has different route shapes and no comparable README. Maintaining two
active contracts would make integration and regression results ambiguous.

**Alternatives considered**:
- Implement every feature in both API trees: rejected because there is no evidence the Expo app
  consumes both and duplicate behavior would drift.
- Delete the alternate tree immediately: rejected because ownership and external consumers have
  not been established.

## 2. API Build and Test Baseline

**Decision**: Make the API package's test, typecheck, and build commands independent from Expo
configuration before adding product behavior.

**Rationale**: `server/tsconfig.json` currently extends `expo/tsconfig.base`, which does not resolve
from the API package. The observed API test, typecheck, and build commands fail while parsing that
configuration, before testing application code. The first fix must restore the existing validation
tools and must not disguise their failure as a successful test run.

**Alternatives considered**:
- Run API tests through mobile's Expo configuration: rejected because server typechecking should
  not depend on the mobile toolchain.
- Ignore test/build failures and proceed with new features: rejected because that makes regressions
  indistinguishable from the known baseline failure.

## 3. Multi-User Test Isolation

**Decision**: Test ownership behavior with at least two distinct test accounts and isolated test
data, including cross-account reads, updates, and deletes. Ensure cleanup occurs even after a test
failure and that repeat/parallel runs do not reuse a single fixed email or record.

**Rationale**: Unauthenticated-route tests alone do not detect broken ownership filters for valid
tokens. Distinct account identities verify real isolation. Database-backed tests should use a
dedicated test database or scoped fixtures; no production or personal database may be used.

**Alternatives considered**:
- A single shared test user: rejected because it cannot prove account separation and conflicts
  across repeated/parallel runs.
- Rely only on manual testing: rejected because deterministic cross-account checks are suitable
  automated regressions.

## 4. Network-Independent Validation

**Decision**: Keep API endpoint selection configurable at runtime. Validate switching between
reachable endpoints and recover from invalid, unreachable, timed-out, or interrupted requests.
Keep the last known working endpoint if a new endpoint cannot pass its health check.

**Rationale**: A device's `localhost` is not the developer computer; emulator loopback addresses
are specific to emulator development; LAN addresses work only when routing and network policy
permit access. Testing across changing networks requires either a reachable current LAN address
or a stable HTTPS API host. A user must be able to change endpoints without rebuilding the app.

**Alternatives considered**:
- Hard-code a developer machine/LAN address: rejected because it changes and is not broadly
  reachable.
- Require all testing devices to use the same Wi-Fi: rejected because it cannot validate the
  different-connection requirement.
- Use public plain HTTP for convenience: rejected because account credentials and tokens would be
  exposed in transit.

## 5. Unreliable Connection Behavior

**Decision**: Distinguish server health-check failures, request timeouts, interrupted connections,
and application/API errors in user-visible outcomes. Preserve unsaved user input where practical.
Do not automatically replay non-idempotent writes unless the request has an idempotency mechanism;
allow safe retry after the user confirms or repeats the action.

**Rationale**: A generic network error must not erase user work or present a failed write as
successful. Blindly retrying meal creation can create duplicates if the server completed a write
but the response was lost. Health checks establish reachability but do not guarantee every later
request will succeed.

**Alternatives considered**:
- Retry every failed request automatically: rejected because a timed-out write may already have
  committed and be duplicated.
- Treat a successful health check as proof all future requests will work: rejected because
  connectivity can change between requests.

## 6. Expo Go as an Integration Environment

**Decision**: Use Expo Go to validate the product flows and device/network behavior that Expo Go
supports. Record unsupported native functionality, including any notification actions or
development-build-only capabilities, as a runtime limitation and provide a separate test path for
those capabilities.

**Rationale**: A passing simulator or typecheck does not verify an installed app's network access,
permission state, or navigation. Conversely, a native feature unavailable in Expo Go is not by
itself proof that the product logic is defective.

**Alternatives considered**:
- Require Expo Go to support every native capability: rejected because its native module set is
  constrained.
- Replace all real-device checks with unit tests: rejected because that would not exercise actual
  network reachability and permissions.

## 7. Specification Discrepancy and Iteration

**Decision**: Before fixing a behavior mismatch, capture expected behavior, observed behavior,
reproduction steps, and evidence. Determine whether the implementation is defective or whether
the specification is incomplete or incorrect. Change the code for a confirmed implementation bug;
update the specification and downstream plan/tasks for a confirmed requirements change.

**Rationale**: Calling every mismatch a bug risks implementing the wrong product. This decision
process keeps changes reviewable and ties completion to measurable behavior.

**Alternatives considered**:
- Always change the code to match the spec without investigation: rejected because the spec can be
  stale, internally inconsistent, or constrained by documented platform behavior.
- Silently revise the spec to match current behavior: rejected because existing behavior is not
  automatically the intended behavior.

## 8. Feature Delivery Order

**Decision**: After stabilization, implement the spec's P1 account/profile/meal-log/timezone and
reminder journeys before the P2 activity/progress/pet/reward experiences. Validate each slice
before proceeding to the next.

**Rationale**: The feature spec prioritizes usable account and meal tracking and user-controlled
reminders as its first independently testable value. Staged delivery reduces the regression
surface and provides a working app earlier.

**Alternatives considered**:
- Build the entire experience in one pass: rejected because it makes debugging and acceptance
  testing less measurable.
- Start visual pet features before account/log reliability: rejected because the core data and
  goals those features depend on would not yet be dependable.

## 9. Responsiveness and Expected-Load Targets

**Decision**: Use the user-provided targets as acceptance thresholds: main screen usable within
3 seconds, common interaction feedback within 100 ms, common transitions within 300 ms excluding
network waits, and at least 95% of ordinary API requests under 1 second client-measured.
Performance verification uses 25 concurrent users making up to 12 ordinary requests per minute
for five minutes, with normal network round-trip latency up to 100 ms and packet loss below 1%.

**Rationale**: Percentile-based measurement makes latency targets testable and avoids allowing
individual fast responses to conceal a poor user experience. Recording test conditions makes
results comparable without claiming production-scale capacity beyond the stated baseline.

**Alternatives considered**:
- Report average latency only: rejected because the average can hide slow tail requests.
- Claim unrestricted production capacity from the baseline load test: rejected because workload,
  deployment size, and traffic profile beyond the defined test have not been specified.

## 10. Concurrent Update and Offline Policy

**Decision**: Detect stale edits to the same profile/record field and reject the later stale write
with a recoverable conflict; preserve the latest saved value. Concurrent changes to different
fields or records both persist. Offline access is read-only for previously loaded data marked
stale; new writes are not queued.

**Rationale**: Explicit conflict detection prevents one session from silently losing another
session's changes. A visible retry after refresh is simpler and safer than silently resolving
ambiguous edits. Offline write queues create ordering and duplicate-submission risks beyond the
current feature scope.

**Alternatives considered**:
- Last-write-wins for concurrent updates to the same field: rejected because it silently discards
  valid user changes.
- Queue offline writes for later replay: rejected because conflict ordering and uncertain commits
  create duplicate or ambiguous state.

## 11. Stability and Resource Verification

**Decision**: Validate zero reproducible crashes in a 30-minute scenario with at least 500 screen
transitions and repeated slow/interrupted/unavailable network events. Observe memory after warm-up
for a sustained upward trend. Report device/runtime, request p50/p95/p99, failure rate, and
resource observations.

**Rationale**: A bounded repeatable scenario gives stability review a consistent basis and
separates normal use from error recovery. Memory behavior varies across devices and runtimes, so
the initial target is to detect a sustained trend and record the conditions rather than assert an
unsupported universal absolute-memory limit.

**Alternatives considered**:
- Use a single launch smoke test: rejected because it does not exercise navigation leaks or
  repeated network recovery.
- Set one absolute memory cap across all devices: rejected because hardware/runtime differences
  make an unqualified cap misleading.

## Increment 2 research (2026-10-25)

## 12. `ExpoTopicSubscriptionModule` error in Expo Go

**Finding**: `expo-notifications` loads `TopicSubscriptionModule.android.js`, which calls
`requireNativeModule('ExpoTopicSubscriptionModule')` as soon as the package is imported. Expo Go's Android binary
does not include that native module (topic subscriptions are remote-push features, removed from Expo Go on Android
in SDK 53), so merely importing the package raises the error, whatever the app then does with it.

**Decision**: Do not import `expo-notifications` anywhere while device reminders are postponed. Gate every dynamic
import behind `REMINDER_DELIVERY_ENABLED`. When notifications return, import only inside a runtime check and wrap
the import in `try/catch` (already done) and use a development build for full behavior.

**Alternatives considered**: remove the dependency (rejected: it is needed later and its config plugin is in
`app.json`); patch the package (rejected: fragile); keep importing and swallow the error (rejected: the error is
still logged as a red box in development and misleads testers).

## 13. Choppy breathing on web

**Finding**: The animation loop re-renders about 25 SVG groups from one shared context 30 times a second even when
only the breathing scale changes by under 1%, and steps at 30 frames per second; both make a subtle motion look
uneven in browsers.

**Decision**: Per-part subscriptions (only a part whose pose changed re-renders), frames driven by
`requestAnimationFrame` at the display rate, and no render when the pose is unchanged. Verify with a recorded frame
time sample in a desktop browser (target: no frame over 33 ms in one minute) before and after.

**Alternatives considered**: CSS keyframe animation for web only (rejected: two code paths, hard to combine with
reactions); lowering amplitude (rejected: hides the symptom).

## 14. Daily goal bar

**Finding**: With a new account in a desktop browser the bar width, the "k/target" label and the API count agree
after each save. The previously unnoticed risk: the server counts days in the account's stored timezone, which
defaulted to UTC for accounts created before the device timezone was sent; late/early local meals then belong to the
neighbouring UTC day.

**Decision**: Make the first task a reproduction (an account with UTC timezone and a meal logged in another timezone's
early hours), turn it into a failing test, then rely on automatic timezone sync (FR-006). If the user's report is about
the streak bar or only appears on phones, extend the investigation there before closing it.

## 15. Reminder blocks equal to the meal target

**Decision**: The server enforces `reminderTimes.length = min(dailyMealGoal, 12)`, filling from a rhythm function:
1 meal 12:00; 2 meals 08:00 and 18:00; 3 meals 08:00, 12:30, 18:30; 4 meals add 15:30; 5 meals add 10:30; 6 or more
spread evenly from 07:30 to 21:00 in 5-minute steps. Raising the target keeps existing times and adds the nearest
unused rhythm times; lowering it removes the latest times unless the schedule was still the untouched default (then it
is regenerated). The cap of 12 keeps the schedule readable and well under platform notification limits.

**Alternatives considered**: client-only logic (rejected: two clients could diverge); one block per meal without cap
(rejected: a target of 312 would create 312 blocks).

## 16. Automatic timezone

**Decision**: The device timezone is the single source. The client sends it at registration and PATCHes the profile
at sign-in/app open when it differs from the stored value. Stored meal moments are absolute, so a change only
affects display and day boundaries.

## 17. Log out

**Decision**: Sign-out is client-side: clear session state, stored token and device reminders. The access token is
stateless and expires on its own (7 days); a server-side revocation list is out of scope. Document this limit.

## 18. Password recovery postponed

**Decision**: Remove the user-facing flow; keep the server code behind `PASSWORD_RESET_ENABLED` (default false) so
no dead endpoint is exposed and the work is not lost. Registration shows the safekeeping notice. Details of what blocks
real email are in `future_considerations.md`.

## 19. App icon from the bear's head

**Decision**: Render the head, ears and face groups of `bear.svg` to square PNGs with the existing SVG renderer
(`@resvg/resvg-js`, development dependency) in a script, on a solid brand-colour background, with safe-zone padding for
the Android adaptive icon. The generated files are committed; the script can be re-run when the art changes.

## 20. Removing `backend/`

**Finding**: `backend/` has 248 lines, six empty files (Bear, DailyActivity, bear/activity/settings routes, energy
service), its own dependency set, and nothing in `server/`, `mobile/`, scripts or docs depends on it.

**Decision**: Delete it, and remove mentions from documentation; Git history keeps the code (last version in commit
`9d0155f`). Record this in `future_considerations.md` so the empty energy/activity placeholders are not lost as ideas.
