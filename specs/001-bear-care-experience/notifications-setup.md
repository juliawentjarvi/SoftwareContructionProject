# Notifications: what works, what to do on your side

> **Postponed (2026-10-25).** Device reminders are switched off in the app (`mobile/src/config/features.ts`) until the rest of the app is finished. This guide is for when they come back; summary and reasons in `future_considerations.md`.

Last updated 2026-10-25. Applies to `mobile/` (Expo SDK 58, `expo-notifications` 58.1.6).

## What the app does

- **Local, scheduled reminders** (a daily notification at each time you pick, 1-8 a day). They are created on the phone
  itself; no server, Firebase or Apple push service is involved, and nothing is sent from our API.
- **Interactive**: each reminder has a **"Log a meal"** action with a text field. Type what you ate and press Save: the
  meal is saved without opening the app, and a short "Meal saved" notification confirms it. Tapping the reminder itself
  opens the meal log.
- **Not used: remote push** (messages sent from a server to phones). Nothing in the project needs it. If you want it
  later it needs Firebase (Android), an Apple push key (iOS) and a server that stores device tokens.

## Where it works

| Runtime | Reminders | "Log a meal" text action | Notes |
|---|---|---|---|
| Web browser | No (explained in the app) | No | Browsers can't schedule daily notifications this way. |
| Expo Go, Android | Yes (local only) | To verify | Expo removed *remote* push from Expo Go on Android in SDK 53; local notifications still work. |
| Expo Go, iPhone | Yes (local only) | To verify | Same. Check that the text field appears when you long-press / pull down the reminder. |
| Development / preview build (Android APK, iPhone) | Yes | Yes (expected) | The reliable way to test; behaves like the finished app. |

"To verify" = designed to work, but I cannot run a phone here. Please check it and write the result in `quickstart.md`
(task T035).

## What I changed (review of the notification setup)

1. **Foreground handler was missing**: without `setNotificationHandler` a reminder that arrives while the app is open is
   silently dropped. Added (banner + list; sound on Android, which needs it to show the pop-up).
2. **Reminders were wrongly disabled in Expo Go.** Local notifications work there, so the block was removed; only the web
   is reported as unsupported.
3. **Android channel was silent and low priority** (`sound: null`, default importance). Now `HIGH` importance with sound
   and vibration, under a new channel id `meal-reminders-v2` (Android keeps a channel's settings from its first creation,
   so changing them needs a new id; on a phone that ran the old version the old "Meal reminders" channel stays in system
   settings and can be ignored).
4. **Taps did nothing.** The reminder carried `data.screen = "meals"` but no listener existed. Added a response listener
   (also for the response that launched the app, then cleared so it isn't replayed).
5. **Interactive action added** (`log-meal` with text input, `opensAppToForeground: false`) on the `meal-reminder`
   category, handled in `src/services/notificationActions.ts`: the typed text becomes the meal name (max 100 chars), the
   meal type is guessed from the time of day, the meal is sent **once** (the response is remembered, also across app
   restarts, and a failed send is reported, never silently retried).
6. **Saving while the app is closed** needs the sign-in token, so it is kept in the phone's secure storage
   (`expo-secure-store`, `src/services/sessionVault.ts`) while signed in and removed when the account is deleted. If no
   token exists the notification asks you to sign in and the app opens the meal log.
7. **App identifiers**: `ios.bundleIdentifier` and `android.package` are set to `com.bearcare.app` (needed for any real
   build). Notification accent colour set to the app green. Change the identifier now if you want a different one; it
   cannot be changed once an app is published.
8. `eas.json` added with `development`, `preview` and `production` build profiles.
9. Security audit: `npm audit fix` applied and test runner `vitest` upgraded to v5 (both packages). Server: 0
   vulnerabilities. Mobile: 5 "high" findings remain, all inside Expo's own command-line tool (`@expo/cli` -> `node-forge`
   has no patched release; `zod` is pinned by Expo). They are development tools, not part of the app on the phone. The
   suggested "fix" (`npm audit fix --force`) would downgrade Expo to version 44, so it was not applied. Re-check after
   Expo SDK updates.

## What you have to do

### A. Try it right now in Expo Go (no accounts needed)

1. Phone and computer on the same Wi-Fi (or share the computer's hotspot). Run the API (`cd server; npm run dev`) and Expo
   (`cd mobile; npx expo start --lan`), scan the QR code with Expo Go. The app finds the API by itself.
2. Sign in, open **Settings -> Meal reminders**, switch on. Allow notifications when the phone asks.
3. To see a reminder quickly: set one reminder time two minutes ahead and press **Save reminder times**.
4. When it arrives: Android - pull the notification down / expand it; iPhone - long-press (or pull down) the notification.
   Choose **Log a meal**, type a meal, press Save. Open the app: the meal should be in the log.
5. If nothing appears: phone Settings -> Apps -> Expo Go -> Notifications must be on. Android: turn off battery
   optimisation for Expo Go; iPhone: check Focus / Do Not Disturb (the app can't override these, by design).

### B. A proper test build (recommended before you rely on it)

Android needs only a free Expo account. iPhone builds that install on a real device need a **paid Apple Developer Program
membership** (about 99 USD per year); the free Apple account only allows apps that expire after 7 days and aren't built by EAS.

```
npm i -g eas-cli
eas login                      # create a free account at expo.dev first
cd mobile
eas build:configure            # accepts the existing eas.json
npx expo install expo-dev-client   # only for the "development" profile; see warning below
eas build --profile development --platform android     # downloads an APK; install it on the phone
eas build --profile development --platform ios         # asks for your Apple login; registers your iPhone
```

- Simplest Android check without the dev client: `eas build --profile preview --platform android`, then install the APK.
- **Warning**: once `expo-dev-client` is installed, `npx expo start` offers the development build instead of Expo Go. Use
  `npx expo start --go` if you want Expo Go again, or leave `expo-dev-client` out until you build.
- A development or preview build connects to the API through the same automatic address while `npx expo start` runs; for a
  build used away from your computer it needs a deployed HTTPS API (set `EXPO_PUBLIC_API_URL` before building).

### C. Things only you can decide / provide

- Whether `com.bearcare.app` is the identifier you want (change in `mobile/app.json`).
- An app icon (`icon` in `app.json`, 1024x1024 PNG) and optionally a monochrome Android notification icon; right now the
  default Expo icon is used.
- The Apple Developer account and Google Play account (25 USD once) if you want to publish.
- Real email for password reset is a separate, postponed item: `future_considerations.md`.

## Known limits (keep in mind when testing)

- Android may delay daily reminders by a few minutes when the phone is dozing; the app does not ask for exact alarms.
- A reminder can't bypass Do Not Disturb or Focus, and the app says so (FR-018).
- Handling the text action while the app is fully closed relies on the phone launching the app briefly in the background.
  Android and iOS can both do this, but iOS may be stricter; if the meal isn't saved in that case, note the phone model and
  OS version in `quickstart.md`. The reminder then still opens the app, and the typed text is not lost silently: a
  "Sign in to save" or "Meal not saved" notification tells you what happened.
- There is no automatic sign-in yet (the session isn't restored when the app restarts), so the secure token only covers the
  time you have been signed in on this phone.
