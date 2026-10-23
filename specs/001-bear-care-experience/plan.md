# Implementation Plan: Bear Care Wellness Experience

**Branch**: `review-baseline` | **Date**: 2026-10-23 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-bear-care-experience/spec.md`

## Summary

Deliver the Bear Care experience in staged, testable increments. First stabilize the existing
backend and test setup without adding product functionality: resolve the API build/test blocker,
establish deterministic tests for distinct users and changing/unreliable network conditions, and
fix confirmed bugs while preserving existing behavior. Do not interpret every spec/code mismatch as
a bug; compare the intended user behavior with the specification and repository context, then
identify whether the implementation or the specification needs correction before changing it.

After the baseline is reliable, implement product requirements in the order and priority in the
feature specification. Validate each slice, then test integrated flows manually in Expo Go where
the runtime supports them. Record failures with reproducible evidence, diagnose their source,
correct implementation or clarify/update the specification as appropriate, and rerun affected
checks.

## Technical Context

**Language/Version**: API TypeScript 5.9 / Node.js; mobile TypeScript 6 / React Native and Expo

**Primary Dependencies**: Expo 57, React Native 0.86, Express 5, Mongoose 8, MongoDB,
Zod 4, Vitest 3, Supertest 7

**Storage**: MongoDB for account-owned data; device storage for the selected API endpoint and
device-local preferences/reminder schedule

**Testing**: Vitest/Supertest for API behavior; isolated MongoDB test data for persistence and
ownership tests; API typecheck/build; mobile typecheck; manual Expo Go integration checks on
emulator and physical device where available

**Target Platform**: Expo-supported iOS, Android, and web clients using a reachable API endpoint;
local development, emulator, LAN, VPN, and stable HTTPS deployment have different reachability
conditions

**Project Type**: Mobile/web client plus HTTP API

**Performance Goals**: Main screen usable within 3 seconds; common interaction feedback within
100 ms; common transitions within 300 ms excluding network waits; at least 95% of ordinary API
requests under 1 second client-measured at the defined expected workload.

**Constraints**: The API package must build and test independently of the Expo package. Do not
assume a device's `localhost`, a fixed developer LAN address, or shared network access. Preserve
the user's last working endpoint when an endpoint health check fails. Tests must not rely on a
shared account or production data. Keep all user data scoped to its authenticated owner. Detect
stale concurrent edits instead of silently overwriting them. Offline access is read-only for
previously loaded, visibly stale data; writes are not queued. Expo Go does not support every
native notification capability; distinguish runtime limitations from application defects.

**Scale/Scope**: Individual accounts with private meal and activity histories. Initial performance
verification assumes 25 concurrent users making up to 12 ordinary requests per minute each over
five minutes; this is a validation baseline, not a production capacity guarantee.

## Constitution Check

| Principle | Gate | Application to this plan |
|---|---|---|
| Simplicity | Pass | Repair the current package and test boundaries before adding architecture or product scope. |
| Maintainability | Pass | Use the documented `server/` API and `mobile/` client as the active integration path. Leave `backend/` untouched until its status is verified; avoid building duplicate behavior. |
| Consistency | Pass | Preserve established route, validation, naming, and response conventions unless the spec explicitly requires a change. |
| Security | Pass with release gate | Test private-resource ownership with distinct accounts, protect credentials, avoid secrets in tests/logs, and require HTTPS for non-local traffic. |
| Testability | Pass with baseline gate | Fix API test/build setup first; make tests deterministic and repeatable across runs, identities, and network outcomes. |
| Usability and Reachability | Pass | Support editing the API endpoint and document emulator, physical-device, and HTTPS deployment setup. Do not promise that private network addresses work off-network. |
| Minimal Changes | Pass | Initial stabilization is limited to confirmed defects and test-enabling changes; no new product features in that phase. |
| Backward Compatibility | Pass with review gate | Preserve current functionality and client/API contracts unless a specification-approved change requires otherwise. |

**Pre-design gate**: Pass with a known baseline defect to address in Phase 0. The API
`server/tsconfig.json` extends an Expo TypeScript configuration that is unavailable from that
package; observed API tests, typecheck, and build fail while loading this configuration. This
prevents trustworthy feature testing and is a stabilization task, not a reason to expand product
scope.

**Post-design gate**: Pass. Design preserves the existing client/API boundary, requires backend
ownership checks, defines field-level conflict handling and explicit offline behavior, and adds
repeatable performance and stability measurements. No constitution exception or unrelated
application is introduced.

## Delivery and Validation Strategy

### Phase 0: Stabilize existing behavior (no new product features)

1. Establish a baseline for mobile typecheck, API tests, API typecheck, and API build.
2. Fix the API package's test/typecheck/build configuration and any directly coupled failures.
3. Identify the active backend boundary and preserve the documented `server/` ↔ Expo client
   contract. Do not delete or expand the alternate `backend/` tree without confirming ownership.
4. Add repeatable API tests using distinct per-test accounts and isolated data. Prove that one
   authenticated user cannot read, update, or delete another user's records.
5. Verify runtime server URL changes across reachable endpoints; cover invalid URLs, unavailable
   servers, request timeouts, interrupted requests, and recoverable retry by a user action. A
   failed candidate URL must not replace the last known working setting.
6. Manually test reachability on emulator and physical device as available. Use a reachable LAN
   address for same-network local testing and a stable HTTPS endpoint for different networks.
7. Fix confirmed bugs only. For a behavior/spec discrepancy, capture evidence and decide whether
   implementation or specification is wrong before changing either.

**Phase 0 exit gate**: API tests, typecheck, and build pass; mobile typecheck passes; two-user
ownership checks pass; endpoint-switch and failure-recovery tests pass; existing behavior has no
untriaged regression. Under the documented baseline workload, API p95 latency is at most one
second on the normal test network. If the measured baseline misses the target, record the
conditions and bottleneck before optimization; do not claim the gate passes.

### Phase 1: Implement specification in priority order

Implement the P1 account, profile, meal log, timezone, goal, and reminder journeys first; preserve
existing behavior where requirements do not demand a change. Then implement P2 activity/progress,
bear presentation, Sudoku, rewards, and customization. Keep changes sliced so each flow can be
tested independently. Feature development must not begin until the Phase 0 exit gate passes.

**Phase 1 exit gate**: Every implemented requirement has a measurable acceptance test or a
documented device/manual check, with no unresolved spec-versus-code discrepancy hidden as a bug.

### Phase 2: Integrated and user-device validation

1. Run API and mobile automated checks.
2. Start the API at a reachable address and run the app in Expo Go.
3. Verify registration/login, profile separation, meal logging and time display, reminder settings
   available in Expo Go, and recovery from server/network changes.
4. Repeat on a second network/device when available. Record Expo Go limitations separately from
   failures expected to work only in a development/production native build.
5. Measure startup, common interaction feedback, and screen transitions against the specification
   on a representative physical device and desktop browser. Measure API p50/p95/p99 latency and
   failure rate at 25 concurrent users on a stable test network; separately exercise slow,
   interrupted, and unavailable networks.
6. Run a 30-minute session with at least 500 screen transitions and repeated network failure and
   recovery; record crashes and memory observations after warm-up.
7. Exercise concurrent updates from two sessions: a stale update to the same field is rejected,
   the latest value remains, and edits to separate fields/records persist independently.
8. Reproduce failures, identify whether the issue is configuration, network, API, client, or
   specification; fix the source and rerun the relevant automated and manual checks.
9. Update the specification only when investigation shows that the user requirement or expected
   behavior needs correction or extension. Feed such changes through `/speckit-specify`, then
   regenerate downstream design/tasks before implementing them.

**Completion gate**: Automated checks and the user's available Expo Go flows pass; unavailable
platform capabilities are documented with a separate validation path; network and multi-user
results are recorded with repeatable steps. Performance reports state target-versus-measured
startup, interaction, transition, API percentile, failure-rate, and resource results plus device,
network, and workload conditions.

## Project Structure

### Documentation (this feature)

```text
specs/001-bear-care-experience/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── api-contract.md
├── checklists/
│   └── requirements.md
└── tasks.md              # Generated in Phase 2 by /speckit-tasks
```

### Source Code (repository root)

```text
mobile/
├── app/                  # Expo screens and navigation
├── src/components/       # Shared mobile UI
└── src/services/         # API client, reminders, device integrations

server/
├── src/                  # Active documented API
│   ├── app.ts
│   ├── validation.ts
│   ├── middleware/
│   └── models/
└── tests/                # API/domain tests

backend/                  # Alternate/legacy tree; ownership and consumers unconfirmed
```

**Structure Decision**: Use the existing `mobile/` client and `server/` API. The API README names
`server/` as the API for the Expo client, and its route contract matches the mobile API service.
Treat `backend/` as out of scope during baseline stabilization unless investigation proves it is
the deployed or required service. This avoids deleting possibly used code while preventing new
duplicate implementation.

## Complexity Tracking

No constitution exceptions are proposed. Do not introduce a new service or test database
infrastructure until the existing API test setup and isolated fixture options have been assessed.
