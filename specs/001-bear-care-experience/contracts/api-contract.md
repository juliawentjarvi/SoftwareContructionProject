# API Contract: Bear Care

This contract records the current API surface and feature-level additions. It targets the
documented `server/` API consumed by the Expo client. Keep existing route paths and response
envelopes stable unless the specification explicitly requires a coordinated change.

## Shared rules

- User-owned routes require a valid bearer token.
- Authorization derives the owner from the verified token; callers cannot choose an owner ID.
- Every private read or mutation scopes the query by both record ID and authenticated owner ID.
- Invalid input does not modify data. Missing/invalid authentication returns `401`.
- Cross-owner records are not returned or modified; return a consistent not-found/authorization
  response without disclosing the other account's data.
- Errors use `{ "error": { "code": "...", "message": "..." } }`.
- Credentials and password-reset capabilities are never included in ordinary profile or log
  responses or logs.
- HTTPS is required for non-local traffic. Browser CORS policy is not authentication.
- Backend authentication, authorization, and validation are authoritative; client-side checks are
  for usability and do not grant access.
- Concurrent updates to the same profile/record field reject a stale write with `409 Conflict`,
  leaving the latest saved value unchanged. Distinct-field and distinct-record updates both
  persist and must not overwrite each other.
- When a client shows cached data offline, it identifies the data as stale and shows its last
  refresh time. Writes are not queued or reported as saved offline.

## Existing routes to preserve

| Method | Path | Auth | Purpose |
|---|---|---:|---|
| GET | `/health` | No | Service health |
| POST | `/api/auth/register` | No | Create account |
| POST | `/api/auth/login` | No | Sign in |
| GET | `/api/auth/me` | Yes | Read current profile |
| DELETE | `/api/auth/me` | Yes | Delete current account and its records |
| GET | `/api/profile` | Yes | Read current profile and goals |
| PATCH | `/api/profile` | Yes | Update display name, timezone (sent by the client from the device), meal goal, reminders |
| GET | `/api/meals` | Yes | List current user's meals |
| POST | `/api/meals` | Yes | Create a meal for current user |
| PATCH | `/api/meals/{mealId}` | Yes | Update an owned meal |
| DELETE | `/api/meals/{mealId}` | Yes | Delete an owned meal |
| GET | `/api/progress` | Yes | Read current user's daily/recent progress |

Registration normalizes email before checking uniqueness and handles concurrent duplicate
registrations without creating two accounts. Meal writes validate name, type, date/time, and
optional notes. Meal lists use bounded filters. Profile meal target accepts positive whole numbers
without a fixed 1–8 cap.

## Required feature additions

### Password recovery (disabled by default in this release)

Routes exist only when the server is started with `PASSWORD_RESET_ENABLED=true`; otherwise they answer 404 and the app
does not offer the flow (FR-064). The text below describes the behavior when enabled.


| Method | Path | Auth | Purpose |
|---|---|---:|---|
| POST | `/api/auth/password/forgot` | No | Request a password reset |
| POST | `/api/auth/password/reset` | No | Set a password with a valid reset capability |

The forgot-password response is generic for known and unknown email addresses. Reset capabilities
expire, are single-use, and are not returned from the request endpoint. Apply request rate limits.

### Activity and steps

| Method | Path | Auth | Purpose |
|---|---|---:|---|
| GET | `/api/activities` | Yes | List only current user's activity |
| POST | `/api/activities` | Yes | Create current user's activity/step entry |
| PATCH | `/api/activities/{activityId}` | Yes | Update an owned activity |
| DELETE | `/api/activities/{activityId}` | Yes | Delete an owned activity |

Activity timestamps are timezone-aware instants. Step count is optional and non-negative when
provided. Progress responses distinguish missing data from a completed step target.

### Rewards

| Method | Path | Auth | Purpose |
|---|---|---:|---|
| GET | `/api/rewards` | Yes | Read current user's points and unlocks |
| POST | `/api/rewards/games/{gameId}/complete` | Yes | Award eligible points once |
| POST | `/api/rewards/unlock` | Yes | Spend points on an available item |

Completion and unlock requests are ownership-scoped and idempotent with respect to game/unlock
references; an operation cannot award twice or spend the balance below zero.

## Client endpoint and unreliable network behavior

- The mobile client accepts a server root or `/api` base, normalizes it consistently, and stores
  the selected address on the current device.
- A failed candidate health check leaves the previously saved working address unchanged.
- Subsequent requests use the selected address without requiring an application rebuild.
- Network errors and timeouts are distinct from API validation/authentication errors where the
  client can determine the difference. Failed requests are never shown as successful.
- Preserve unsaved form input on connection failure where practical.
- Do not automatically retry non-idempotent writes unless the operation has a deduplication key;
  a retry after uncertain completion could create duplicate meals.
- A write that is retried after an uncertain response is deduplicated by an operation identity or
  requires explicit user review before retry. Do not automatically replay a meal, energy charge,
  or reward request without deduplication.
- Emulator loopback addresses are development-only. Physical-device local testing uses a
  reachable LAN/VPN address. Different-network use requires a reachable stable HTTPS host.

## Performance and reliability targets

- Main screen usable: within 3 seconds in at least 95% of 20 launches on each representative
  device/runtime.
- Common interaction feedback: within 100 ms for at least 95% of measured interactions.
- Common screen transition: within 300 ms for at least 95% of transitions, excluding network waits.
- Ordinary API response: at most 1 second client-measured for at least 95% of requests in the
  five-minute expected-load test of 25 concurrent users at up to 12 requests per user per minute.
- Normal-network condition: stable connection with round-trip latency up to 100 ms and packet loss
  below 1%. Record actual test conditions and report p50, p95, p99, and request failure rate.
- Record resource observations and unmet targets. Do not infer production capacity beyond the
  specified test workload.

## Multi-user test contract

Use distinct, isolated test identities, never a production account. With valid tokens for users A
and B, verify that B cannot read, update, or delete A's known meal/activity identifiers. Confirm
that unauthenticated access fails, duplicate normalized registration is rejected, and test cleanup
removes all created records even when a test fails.

For concurrency tests, submit edits from two sessions based on the same field value. Verify the
first accepted update persists and a stale update to that same field receives a recoverable
conflict. Concurrent edits to different fields or records both persist independently. Repeat
under the expected-load test and verify there are no cross-user reads or unintended overwrites.

## Increment 2 changes (2026-10-25)

- `PATCH /api/profile` with `dailyMealGoal` returns `reminderTimes` reconciled to the new target (length
  `min(goal, 12)`, rules in `data-model.md`); a request that sets both fields must send a list of that length or is
  rejected with `400 INVALID_REQUEST`.
- `PATCH /api/profile` with `reminderTimes` alone must contain exactly `min(current goal, 12)` distinct times.
- New accounts: `dailyMealGoal` 3 and reminders 08:00, 12:30, 18:30 (previously 09:00, 13:00, 19:00).
- Sign-out has no endpoint (client-side only); the token expires on its own.
- Timezone updates arrive through the same `PATCH /api/profile` as `{ "timezone": "<IANA name>" }`.

## Phase 5 slice 1 additions (2026-10-25)

- `PATCH /api/profile` accepts `stepTarget` (whole number 1 to 1,000,000, or `null` for "not set"); profile responses include
  `stepTarget` (`null` when not set).
- `/api/activities` as described above: `type` (1 to 60 characters), `occurredAt` (ISO time with offset), optional
  `stepCount` (whole number 0 to 1,000,000; absent means "no step information", `0` is a real value; `null` on PATCH clears it),
  optional `notes` (up to 280 characters). Same list parameters as meals (`from`, `to`, `limit`).
- `GET /api/progress` now also returns, for today: `steps` (`null` when no step entry exists), `stepTarget`, `stepsMet` (never
  true without a target or without step data) and `energy` `{ points, target, fill }` (points: +10 per meal, +5 per full 1,000
  steps, -5 per Sudoku start; target: 10 per planned meal; fill: 0 to 100, empty while negative). Each entry of
  `lastSevenDays` also has `steps` and `energyPoints`. Streak rules are unchanged (meals only).

## Phase 5 slice 2 additions (2026-10-25)

- **Streak and health in `GET /api/progress`**: `currentStreakDays` counts consecutive days on which the meal target was
  met and, when `stepTarget` is set, the step target too (a day without step data then does not qualify); `lastSevenDays[].qualifies`
  shows each day's result. `bearHealth` is `"low"` after two completed days below the meal target (never for days before the
  account existed) and `"good"` again as soon as today's meal target is met.
- **`POST /api/sudoku/games`** `{ "gameId": "<uuid made by the app>" }` -> `201` for a new game, `200` for a repeat of the same id.
  Starting a game costs 5 energy, counted from the game's start time on the user's local day, **once per game id**
  (repeats, retries and resuming never charge again).
- **`POST /api/sudoku/games/{gameId}/complete`** -> `{ "rewardPointsAwarded", "points" }`; the first completion awards 10
  reward points, later ones award 0; `404` for an unknown game or another user's game.
- **`GET /api/rewards`** -> `{ "points" }`, the reward balance. Reward points and energy are separate; neither changes the other.
- The puzzle itself is made and checked on the phone; the server records only start and completion (it does not verify the
  solution), which is acceptable for a private wellness app but would need a server-held puzzle if rewards ever had real value.
