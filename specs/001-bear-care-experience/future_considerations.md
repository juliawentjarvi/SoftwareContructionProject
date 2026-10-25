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
