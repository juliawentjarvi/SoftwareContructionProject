# Progress Notes: Bear Care

Working notes kept next to the spec so anyone (or any Claude session) can pick up where we left off.
Authoritative requirements stay in `spec.md`; task status stays in `tasks.md`. Last updated 2026-10-23.

## Status

| Phase | State |
|---|---|
| 1 Setup, 2 Stabilization | Done (T001-T016) |
| 3 User Story 1 (account + meals) | T017-T025 done; **T026, T027 left** (see below) |
| 4 User Story 2 (reminders) | Not started (T028-T035) |
| 5 User Story 3 (steps, energy, Sudoku, rewards) | Not started, except bear animation T058-T060 and T061 (done), T062 (device validation) open |
| 6 Polish / performance | Not started (T050-T057) |

## Bugs found in manual testing (fixed 2026-10-23, verified in headless Edge against the real app)

1. **Meal saved -> bear reaction and "Log another meal" offer.** Two causes:
   - `mobile/.env` still pointed at an old LAN address (`EXPO_PUBLIC_API_URL`), so requests timed out and no meal saved.
     The laptop's address changes between networks: update `mobile/.env` (or the app's Connection settings) and restart
     Expo with `--clear` when it does. Check with `ipconfig` and `curl http://<ip>:3000/health`.
   - The bear is created fresh when the home screen reappears, so it missed the "fed" signal. It now receives
     `fedAt` (a timestamp) and plays the jump/wave/hearts if the meal was saved in the last 3 seconds.
   - Also checked: the seven-second banner shows after a save, disappears, and "Log another meal" opens a cleared form.
   - Hearts were clipped at the top of the bear's frame; the visible area was enlarged.
2. **Breathing and blinking missing on web.** Cause: Windows/browser "reduce motion" is on, and the bear (by design,
   FR-061) pauses breathing, blinking, ear waves and bored moves then. Tap and feed reactions are unaffected.
   Added Settings -> "Bear animations" switch ("Always animate the bear") that overrides this; FR-061 updated.
   Verified: with reduce-motion emulated, the bear is still until the switch is on, then breathes and blinks.
   To change the OS setting instead: Windows Settings -> Accessibility -> Visual effects -> Animation effects.

## Left in Phase 3 (User Story 1)

- **T026** Password reset: generic request + single-use, time-limited reset; never reveal whether an account exists and
  never return/log the reset credential (FR-005). Needs a decision on how the reset link/code is delivered (no email
  service exists yet).
- **T027** Run `npm test`, `npm run typecheck`, `npm run build` in `server/`, `npm run typecheck` in `mobile/`; check the
  User Story 1 independent test; mark the checkpoint.
- **FR-007 UI**: the meal-target picker in `mobile/app/settings.tsx` is still buttons 1-8. The server accepts any positive
  whole number; the picker should too.
- Manual checks not yet done: seven-second prompt and in-page deletion confirmation on phone (Expo Go) and desktop
  browser; record in `quickstart.md`.
- Account deletion on the server uses a MongoDB transaction (works on Atlas; needs a replica set locally).

## How we work (agreed)

- One slice at a time: 3-5 related tasks, tests first, then code; run typecheck/tests; tick `tasks.md`; short report.
- Change `spec.md` before code when behavior changes. Do not pull in tasks from later phases.
- Spec Kit skills currently live in `server/.claude/skills`; to use `/speckit-*` from the repo root they would have to be
  moved or copied to `.claude/skills` at the root.

## Running things

- API: `cd server; npm run dev` (needs `server/.env`). Tests: `npm test`; database-backed tests need `TEST_MONGODB_URI`
  pointing at a database named `bear_buddy_test` (see `quickstart.md`).
- App: `cd mobile; npx expo start --lan` (Expo SDK 58). Do not use CI mode, it disables file watching. Press `w` for web,
  or scan the QR code in Expo Go on the same Wi-Fi. API address is set in `mobile/.env` (`EXPO_PUBLIC_API_URL`) or in the
  app under Connection settings.
- Bear artwork: `mobile/assets/bear/bear.svg`; rebuild the component after editing it with `npm run generate:bear` in
  `mobile/`. Animations are defined in `mobile/src/components/bear/animation.ts`.
