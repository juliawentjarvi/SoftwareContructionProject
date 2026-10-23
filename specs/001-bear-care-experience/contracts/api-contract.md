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
| PATCH | `/api/profile` | Yes | Update profile, timezone, meal goal, and reminders |
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

### Password recovery

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
