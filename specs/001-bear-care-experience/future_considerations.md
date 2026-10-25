# Future Considerations

Things deliberately postponed. Each entry says what is postponed, why, where the related code is, and what would
unblock it. Last updated 2026-10-25.

## 1. Password-reset email delivery (Brevo)

**Status: postponed.** The reset flow itself is built and tested (request code -> email -> enter code and new
password). Only *real email delivery* is not working, so on a normal machine nobody receives the code.

### Why it is postponed

Sending password-reset mail to arbitrary users through Brevo needs things the project does not have yet:

- **A domain we control.** Sending "from" a free mailbox address (for example a Gmail address) works poorly: such
  messages fail authentication checks and tend to be rejected or land in spam.
- **Domain authentication (DKIM, plus SPF/DMARC).** The domain's DNS records must be set up and approved by the
  provider so receivers can verify the mail really comes from us. Brevo expects this for transactional sending.
- **A low spam-complaint rate (provider threshold below roughly 0.3 %).** A new sender with no reputation, or messages
  that get marked as spam, can get the account limited or suspended. This is easier to keep under control once a proper
  domain and sender identity exist.

Until a domain is available, the effort of getting the sender approved is not worth it for this stage of the project.

### Where Brevo is in the code

| What | Where |
|---|---|
| Sending through Brevo's HTTP API (`https://api.brevo.com/v3/smtp/email`), sender parsing, error handling | `server/src/mailer.ts` (`BREVO_ENDPOINT`, `parseSender`, the `options.brevoApiKey` branch of `createPasswordResetSender`) |
| `BREVO_API_KEY` and `MAIL_FROM` settings | `server/src/config.ts` |
| The settings being handed to the mailer when the API starts | `server/src/index.ts` |
| Tests (request shape, key never in body, safe error message, sender parsing) | `server/tests/brevo.test.ts` |
| Documented setup steps and variable examples | `server/README.md` (local setup, step 3) and `server/.env.example` |
| Your own key and sender address | `server/.env` (git-ignored, never committed) |

The code path is only used when `BREVO_API_KEY` has a value. Delivery priority in `createPasswordResetSender` is
Brevo, then SMTP (`SMTP_URL`), then, outside production, a development file outbox, then nothing.

### Current behavior

- `server/.env` currently has a `BREVO_API_KEY`, so the API tries Brevo first. While the sender is not approved, Brevo
  rejects or filters the message and the server console shows `Brevo rejected the message (HTTP ...)`. The user always
  gets the same generic answer (by design), so they only notice that no email arrives.
- **To use the working development fallback again**, comment out or delete `BREVO_API_KEY` in `server/.env`
  (`# BREVO_API_KEY=...`) and restart the API. The reset code is then written to `server/.dev-outbox/` (git-ignored),
  which is enough to test the flow on a development machine. In production without any mail setting, nothing is sent.

### What would unblock it

1. Get a domain and add Brevo's DKIM (and SPF/DMARC) DNS records; wait for Brevo to approve the sender/domain.
2. Set `MAIL_FROM` to an address on that domain, e.g. `Bear Care <no-reply@yourdomain>`.
3. Keep complaints low: send only on explicit user request (as now), plain text, no marketing content.
4. Try a reset to a real mailbox and check inbox placement; then make "Forgot password" part of manual device testing.
5. Alternative providers need only the same domain steps; the SMTP option (`SMTP_URL`) already works with any provider.

### Related

- Spec: FR-005 and the account-recovery assumption in `spec.md`; task T026 in `tasks.md` (done, delivery pending).
- Commit `0a056fd`: "message mail forgot password doesn't work yet. Should work with brevo, but unresponsive for now".

## 2. Device reminders and interactive notifications (including development builds)

**Status: postponed until the rest of the app is complete.** Setting up a development build (EAS, Apple developer
account, installing a custom client) is more effort than it is worth right now. In the meantime the app is honest about it:
both reminder switches stay off and say that reminders are still being figured out (FR-065). Reminder times are still
editable and saved. The full step-by-step guide for later is `notifications-setup.md` (kept up to date, read it first).

### The Expo Go error (`ExpoTopicSubscriptionModule`) - fixed

- **What it was**: `expo-notifications` asks the phone's native code for a module named `ExpoTopicSubscriptionModule` as
  soon as the package is imported. Expo Go on Android does not contain it (remote push features were removed from Expo Go
  on Android in SDK 53), so importing the package alone raised the error.
- **Fix**: the switch `features.reminderDelivery` in `mobile/src/config/features.ts` is `false`. While it is false the
  package is never imported: `reminders.ts` (all dynamic imports sit behind the support check), `notificationListener.ts`
  and `sessionVault.ts` (secure storage) all return early. Tests in `mobile/src/services/reminders.test.ts` prove nothing
  is called.

### Where the notification code is (all kept, switched off)

| What | Where |
|---|---|
| The on/off switch | `mobile/src/config/features.ts` (`reminderDelivery`) |
| Permission, scheduling, channel, foreground handler, "Log a meal" text action | `mobile/src/services/reminders.ts` |
| What a tap or an answer means, duplicate protection | `mobile/src/services/notificationActions.ts` |
| Listening for taps and answers | `mobile/src/services/notificationListener.ts` |
| Token in secure storage so the action can save while the app is closed | `mobile/src/services/sessionVault.ts` (`expo-secure-store`) |
| One place for turning reminders on or off from home and settings | `mobile/src/services/reminderSettings.ts` |
| Honest reminder note shown to users | `mobile/src/services/copy.ts` |
| App identifiers, notification colour, secure-store plugin | `mobile/app.json` |
| Build profiles (development, preview, production) | `mobile/eas.json` |
| Server-side times rules (1 to 12 distinct times, one per meal) | `server/src/validation.ts`, `server/tests/reminders.test.ts` |

### Issues found in the notification set-up (all addressed in code, kept for when it is switched back on)

1. No foreground handler (reminders arriving while the app was open were dropped).
2. Reminders were wrongly blocked in Expo Go although local notifications work there.
3. The Android channel was silent and low priority (now high importance, new channel id `meal-reminders-v2`).
4. Taps on a reminder did nothing (a listener now opens the meal log).
5. No interactive action (a "Log a meal" text field was added; saved once, remembered across restarts).
6. Saving while the app is closed needs the sign-in token, kept in secure storage.
7. App identifiers (`com.bearcare.app`) were missing for any real build.
8. Security audit: `npm audit fix` and `vitest` 5; the remaining 5 "high" findings sit inside Expo's own command-line tool
   (`node-forge` has no patch, `zod` is pinned by Expo) and are not part of the app on the phone. Do not run
   `npm audit fix --force` (it would downgrade Expo to version 44). Re-check after SDK updates.

### What to do on your side when you come back to this

1. Read `notifications-setup.md` (Expo Go test, then development build with EAS, Apple Developer Program about 99 USD per
   year for iPhone builds, Android only needs a free Expo account).
2. `npx expo install expo-dev-client` only when building a development client; afterwards `npx expo start --go` gives Expo
   Go again.
3. Set `features.reminderDelivery = true`, run the device checks (task T035), and write the results in `quickstart.md`.
4. Decide on the app icon and the identifier `com.bearcare.app` before the first store build.

### Known limits to keep in mind

- Android may delay daily reminders a few minutes (no exact alarms requested); reminders cannot bypass Do Not Disturb or
  Focus (FR-018).
- The text action saving a meal while the app is fully closed is unverified, especially on iPhone.
- There is no automatic sign-in on app restart, so the stored token only covers the time the user has been signed in.
- Remote push (server-sent) is not used and would need Firebase, an Apple push key and device tokens on the server.

## 3. Items from the 2026-10-25 hands-on test round

Captured in the specification as User Story 4 (FR-062 to FR-069, SC-023 to SC-028); planned in `plan.md` ("Increment 2");
tasks T063 to T084 in `tasks.md`. Summary of what was found: choppy breathing on web, animate setting should be on/off,
log out needed, timezone should be automatic, reminders should match the meal count, daily goal bar problem, remove
"forgot password" with a safekeeping notice, honest reminder switch, bear-head app icon, remove the unused `backend/` folder.

## 4. The removed `backend/` folder

`backend/` (an early alternative API: auth, meal and middleware code; empty placeholders for bear, activity, settings and an
energy service) was deleted on 2026-10-25 because `server/` replaced it and nothing used it. It is still in Git history:
`git show 9d0155f:backend/src/server.ts` (last commit that touched it). When Phase 5 builds activity, energy and rewards,
build them in `server/`; the empty placeholders held no code worth recovering.

## 5. Logging meals and other functions offline (airplane mode)

**Status: not built, postponed.** The current rule in the specification is deliberately the opposite: offline use is limited
to viewing data that was already loaded, and new or changed records are **not** queued (FR-047, FR-048, FR-049). A write that
fails is reported as failed, the typed values stay in the form, and nothing is sent later behind the user's back. Doing
offline logging means changing those requirements first (run `/speckit-specify`), then planning and tasking it.

### What happens today in airplane mode

- The app on launch with a stored sign-in shows "Can't reach the Bear Care server" with "Try again"; the person stays signed in but
  cannot get past that screen (nothing is cached to show instead).
- Already signed in and in the app: logging a meal, deleting one, changing settings or reading the goal bar fails with a clear
  message; entered meal text stays in the form for another try.
- Works without a connection: the bear and its animations, and anything that never asks the server.
- Not built yet: showing previously loaded data with a "may be out of date, last refreshed at ..." label (FR-048, task T054).
  That read-only caching is the sensible first step before any offline writing.

### What offline use could look like (ideas to decide on later)

| Function | Offline idea | Difficulty |
|---|---|---|
| View meals, goal bar, progress | Keep the last loaded copy on the device; label it stale with its refresh time | Small |
| Log a meal | Save on the device as "waiting to sync", count it on the goal bar, send when a connection returns | Medium |
| Delete or edit a meal | Queue the change; if the meal itself is still unsent, just change the queued copy | Medium |
| Settings (target, reminder times, animate) | Keep the change locally and send later; the server is the source of truth, so conflicts need a rule | Medium |
| Sudoku and rewards (future, Phase 5) | Play locally; send energy cost and reward once, with a one-time id, when online | Medium to large |
| Sign-in, registration, log out | Sign-in and registration need the server. Log out works offline. | Fixed by nature |

### What it would need

1. **Duplicate protection (FR-047)**: every queued meal gets an id made on the device; the server stores it with a unique index
   so a resend after a lost response is recognised and not saved twice. This is the main server change.
2. **A durable queue on the device**: saved in local storage, survives app restarts, sent one at a time in order, never dropped
   silently. Items show "waiting to sync", "sent" or "needs attention" (for example the sign-in expired, or validation failed).
3. **Rules for sending**: when connectivity returns or the app opens; limited retries with a clear failure state; no automatic
   retry of something the server rejected as invalid.
4. **Conflicts**: field-level conflict detection already exists on the server for same-field edits (FR-051); queued edits
   would carry the version they started from and show the same "refresh and try again" outcome.
5. **Time**: the meal's real eaten-at moment is kept, not the time it syncs; day boundaries use the device timezone at the
   time of entry (the account timezone follows the device).
6. **Sign-in while offline**: the stored token may expire (30 days) while a queue is waiting; the person must sign in again
   and then the queue is sent under that account only (never to another user who signs in on the same phone: queue is
   tied to the account and cleared on log out, with a warning if unsent items exist).
7. **Honest wording everywhere**: "saved on this phone, will be sent when you're online", never "saved" for something the
   server has not confirmed.
8. **Tests**: queue persistence, double-send protection, expired sign-in, two accounts on one phone, reconnect storm, and a
   manual airplane-mode checklist on Android and iPhone.

### Specification changes this needs (when you decide to do it)

- Replace the "no queued writes" parts of FR-049 and the offline assumption with a precise queued-write rule.
- Add acceptance scenarios and success criteria (for example: a meal logged in airplane mode appears with a "waiting" label, and
  after reconnecting exactly one copy exists on the server).
- Decide which functions are in scope first (meals only is the smallest useful version).

## 6. Music, sound effects and the mute control (FR-027, FR-028)

**Status: not built, postponed.** The shop sells treats, looks and background themes (the "backgrounds" half of FR-027), but there is
no music or sound yet, so there is deliberately no mute switch either: a switch that mutes nothing would be pretending, like the
reminder switch we fixed. Needed to build it:

- Audio files (music loops, a few sound effects such as a chime for solving Sudoku and a happy sound for treats) with a licence
  that allows use in the app; a decision whether music is part of the shop (unlockable tracks) or free.
- An audio library for Expo (`expo-audio`), tested in Expo Go on both phones and in the browser (browsers block sound until the
  person has tapped something, so music starts after the first tap).
- A single sound on/off setting kept on the device, off by default or on? (decide), applied to music and effects.
- FR-028: muting must not touch meal reminders or the saved notification setting; keep sound preferences and the reminder switch
  completely separate in code, and add a test for it.
- Where it should live in settings: next to "Animate the bear".

## 7. Reading steps from the phone's health app (instead of typing them)

**Status: not built, postponed (decided 2026-10-25).** Steps are entered by hand (FR-012/013; the specification says automatic
collection from a health service is outside this feature). Manual entry also stays as the fallback, because the web version can never
read a health app and not everyone wears or carries the data.

### What is possible

| Route | Works in | What it reads | Needs |
|---|---|---|---|
| Apple Health (HealthKit) | iPhone, **development build only** (not Expo Go) | Real daily totals, including Apple Watch and other apps | A native HealthKit module (a third-party Expo module, since there is no official one in Expo), the HealthKit capability and a usage text in the app config, an EAS development build and an Apple Developer account (see `notifications-setup.md`), the person's permission |
| Android Health Connect | Android, **development build only** | Daily step totals from the phone and other apps that write to Health Connect | A native Health Connect module, permissions declared in the app, a Play Store data-safety/health declaration when published, Health Connect installed (built in on recent Android) |
| The phone's step counter (`expo-sensors` Pedometer) | **Expo Go**, iPhone | Today's steps from the phone's own motion coprocessor, up to 7 days back; not Apple Watch data | Nothing extra. Android only counts live while the app is running (no history), so it is not reliable there. Web: not available |
| Manual entry (today) | Everywhere | What the person types | Nothing |

Each module's compatibility with Expo SDK 58 has to be checked when it is time to build this; the search done on 2026-10-25 found
only third-party modules.

### Note on Apple being easier

Apple's side is the simpler one: HealthKit is a single, well-documented system with one permission prompt and consistent step totals,
which is why it felt easy in your earlier vibe-coded app (as you described it). Android's Health Connect has more moving parts
(separate app on older versions, per-data-type permissions, a store review of health data use). So when this is picked up, do
**iPhone first** (HealthKit through a development build, or the pedometer shortcut if a development build is still unwanted),
keep manual entry for everyone else, and add Android afterwards.

### How it would fit the existing app

- A step entry stays a normal activity record, so the energy points (+5 per full 1,000 steps), the step target, the streak and
  the goal display keep working unchanged.
- Synced steps should replace the previous synced total for that day (one "Phone steps" entry per day), not add to it each time,
  and never overwrite what the person typed: show both and let the server sum them, or ask which to keep.
- Sync on opening the app and on a "Refresh steps" button; tell the person plainly when permission was refused, and never show
  "0 steps" for "no permission or no data" (the app already distinguishes missing from zero).
- Specification: replace the "steps are entered by the user" assumption, add acceptance scenarios for permission granted, denied,
  revoked, and a day with no data; add a success criterion (for example, steps shown within 5 seconds of opening the app on a
  phone with Health data).
- Privacy: health data is read on the phone and only the daily total is sent to the account; say so in the permission text and in
  the app.
