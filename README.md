# Bear Care

A small wellness app: log meals and steps, keep a streak, look after a bear, play Sudoku and spend the points you earn.
It runs on Android, iPhone and in a web browser. The app (`mobile/`) talks to a small API (`server/`) that stores accounts and
records in MongoDB.

```
mobile/   Expo (React Native) app: phone and web
server/   Express + MongoDB API
specs/    Specification, plan, tasks and notes (Spec Kit) for the project
```

## Try it (about 10 minutes)

You need Node.js (LTS) and a free MongoDB Atlas database. Test on a phone with the **Expo Go** app, or in a desktop browser.

1. **API.** In `server/`: copy `.env.example` to `.env`, set `MONGODB_URI` (your Atlas connection string) and a random
   `JWT_SECRET` of at least 32 characters, then run `npm install` and `npm run dev`. Check `http://localhost:3000/health` shows
   `{"status":"ok"}`. More detail and the API list: [`server/README.md`](server/README.md).
2. **App.** In `mobile/`: run `npm install` and `npx expo start --lan`.
   - **Browser:** press `w`, or open `http://localhost:8081`.
   - **Phone:** put the phone on the same Wi-Fi (or share the computer's hotspot), open Expo Go and scan the QR code.
   - The app finds the API on the computer that serves it, so nothing needs configuring when the network changes. If it can't
     connect, check the computer's firewall allows Node.js and that the network doesn't isolate devices; Connection settings on the
     sign-in screen can override the address.
3. Create an account. There is no "forgot password" yet, so remember or write down the password.

## Checks

```
cd server && npm test && npm run typecheck && npm run build
cd mobile && npm test && npm run typecheck
```

Database-backed API tests need `TEST_MONGODB_URI` pointing at a database named `bear_buddy_test` (see
[`specs/001-bear-care-experience/quickstart.md`](specs/001-bear-care-experience/quickstart.md)); without it they are skipped.

## What works today, and what does not

Works: accounts and staying signed in, meal log with times in your timezone, steps and activity log, daily goal, energy, care
streak heart, a bear that reacts and idles, Sudoku with reward points, a reward shop (treats, looks, backgrounds), profile
picture, settings, log out.

Postponed on purpose (the app says so where it matters): meal reminders on the phone, password recovery by email, music and
sound, logging while offline. Reasons and how to pick them up again: [`specs/001-bear-care-experience/future_considerations.md`](specs/001-bear-care-experience/future_considerations.md).

## More

- Where the project stands and what is next: [`specs/001-bear-care-experience/progress-notes.md`](specs/001-bear-care-experience/progress-notes.md)
- The specification and task list: [`spec.md`](specs/001-bear-care-experience/spec.md), [`tasks.md`](specs/001-bear-care-experience/tasks.md)
- The bear artwork is `mobile/assets/bear/bear.svg`; `npm run generate:bear` and `npm run generate:icon` in `mobile/` rebuild the
  animated component and the app icons from it.
