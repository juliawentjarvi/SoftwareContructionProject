# Progress Notes: Bear Care

Working notes kept next to the spec so anyone (or any Claude session) can pick up where we left off.
Authoritative requirements stay in `spec.md`; task status stays in `tasks.md`. Last updated 2026-10-23.

## Status

| Phase | State |
|---|---|
| 1 Setup, 2 Stabilization | Done (T001-T016) |
| 3 User Story 1 (account + meals) | Done (T017-T027); only manual phone/desktop checks remain |
| 7 Increment 2 / User Story 4 (polish, honest settings) | Done in code and checked in a browser (T063-T083 except T071 phone check); **left: T084 and T088 phone checks**; staying signed in added (FR-070) |
| 4 User Story 2 (reminders) | T028, T029, T031-T034 done; **left: T030 (screen-level tests), T035 (device checks, see `notifications-setup.md`)** |
| 5 User Story 3 (steps, energy, Sudoku, rewards) | Bear animation done (T058-T061); steps, activity log and energy points done (T036, T037, T040-T044); streak, bear health and Sudoku with rewards earned are done (T038, T045-T047); **left: reward spending and customization (T039, T048), T049 checks, T062 device check, the heart-shaped rainbow streak indicator (FR-022/023)** |
| 6 Polish / performance | Not started (T050-T057) |

## Bugs found in manual testing (fixed 2026-10-23, verified in headless Edge against the real app)

0. **Server address is now automatic in development** (2026-10-24): the app derives the API address from the host that serves it (page host on web, Expo dev-server host in Expo Go), port 3000; saved Connection-settings address overrides it, "Use automatic address" clears that; `EXPO_PUBLIC_API_URL` is only the fallback for builds without a dev server. Server allows dev web origins on :8081/:19006 outside production. Verified on web via localhost and the LAN IP; **not yet verified in Expo Go on a phone**. Replaces the "update mobile/.env" advice below.
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

## Phase 3 (User Story 1) wrap-up

- Password reset (T026) is built: hashed single-use 30-minute code; delivered by SMTP (`SMTP_URL`) or, in development
  only, written to `server/.dev-outbox/`. Real delivery via Brevo is **postponed** (needs a domain, DKIM approval and a low
  spam rate): see `future_considerations.md`.
- Meal target (FR-007) is now a number field (any whole number from 1), no longer buttons 1-8.
- Still to do by hand, on phone (Expo Go) and desktop browser: seven-second banner, deletion confirmation, password reset,
  timezone display. Record results in `quickstart.md`.
- Account deletion on the server uses a MongoDB transaction (works on Atlas; needs a replica set locally).
- Next: you run the device checks (T035) using `notifications-setup.md`; then Phase 5.

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

## Decisions

- Streak rule (T045), decided 2026-10-25: a day qualifies on meals, and on steps too only when a step target is set.
