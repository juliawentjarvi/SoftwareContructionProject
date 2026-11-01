## SDD Automated server test results
``` RUN  v5.0.5 C:/Users/eevin/SoftwareContructionProject/server

 ✓ tests/profile-picture.test.ts (12 tests) 3663ms
   ✓ profile picture storage (2)
     ✓ starts without a picture, stores one, can replace it and remove it 2012ms
     ✓ keeps one account's picture private from another and never includes it in profile responses 1111ms
 ✓ tests/energy.test.ts (11 tests) 9ms
 ✓ tests/reminder-schedule.test.ts (23 tests) 4428ms
   ✓ profile reminders follow the meal target (4)
     ✓ gives new accounts a three-meal default schedule 1826ms
     ✓ adds and removes reminders when the meal target changes, and caps them at twelve 1023ms
     ✓ accepts edited times only when their number matches the meal target 453ms
     ✓ keeps edited times when the target grows 645ms
 ✓ tests/activities.test.ts (13 tests) 5722ms
   ✓ activity entries (4)
     ✓ lets an owner create, list, change and delete entries, with the instant stored exactly 1916ms
     ✓ allows an entry without steps and keeps that distinct from zero steps 1001ms
     ✓ keeps one user from reading, changing or deleting another user's entries 1021ms
     ✓ reports steps and energy in progress, and recalculates after a correction or deletion 1188ms
 ✓ tests/streak.test.ts (10 tests) 10ms
 ✓ tests/reminders.test.ts (12 tests) 2906ms
   ✓ reminder preferences are stored per account (2)
     ✓ keeps times when reminders are switched off or the timezone changes, and never touches another account 1588ms
     ✓ rejects an invalid schedule without changing the stored one 912ms
 ✓ tests/password-reset.test.ts (6 tests) 7691ms
   ✓ password reset (4)
     ✓ answers identically for known and unknown emails, and only sends to a real account 1855ms
     ✓ stores only a hash of the reset token 939ms
     ✓ changes the password once with a valid token, and the token cannot be reused 2034ms
     ✓ rejects an expired token, a wrong token, and a token superseded by a newer request 2264ms
 ✓ tests/meals.test.ts (9 tests) 3258ms
   ✓ meal records (2)
     ✓ stores the exact instant for a time entered with a UTC offset and trims text 994ms
     ✓ lets an owner read, update and delete a meal, and hides it from other users 1867ms
 ✓ tests/concurrency.test.ts (9 tests) 8598ms
   ✓ same-field conflicts and independent fields (7)
     ✓ starts every field at version 0 and raises a field only when it changes 1897ms
     ✓ keeps the first update and rejects a stale edit of the same field with a recoverable conflict 1081ms
     ✓ lets edits to different fields both persist 908ms
     ✓ lets exactly one of two simultaneous edits of the same field win 502ms
     ✓ treats a change of the meal target as a change of the reminder times too, so a stale reminder edit is rejected 612ms
     ✓ still accepts an update that sends no expected versions 957ms
     ✓ applies the same rules to meals and activity entries, and keeps other accounts out 2092ms
 ✓ tests/sudoku.test.ts (7 tests) 9288ms
   ✓ sudoku energy cost and rewards (6)
     ✓ charges 5 energy once when a game starts: five meals for a five-meal target go from 100% to 90% 2699ms
     ✓ never charges twice for the same game, however often the start or resume is repeated 1125ms
     ✓ lets earnings offset a negative balance first 940ms
     ✓ awards reward points once per completed game, separate from energy 1211ms
     ✓ cannot complete a game that was never started, or someone else's game 1865ms
     ✓ removes a deleted account's games 880ms
 ✓ tests/ownership.test.ts (1 test) 1947ms
   ✓ user-owned meal records (1)
     ✓ prevents a second authenticated user from reading or changing another user meal 1367ms
 ✓ tests/app.test.ts (5 tests) 142ms
 ✓ tests/auth.test.ts (8 tests) 3989ms
   ✓ registration and login accounts (3)
     ✓ registers an account without returning the password or its hash 780ms
     ✓ rejects a duplicate account whose email differs only by case or surrounding whitespace 874ms
     ✓ signs in with a valid password regardless of email case, and rejects a wrong password 1108ms
 ✓ tests/refresh.test.ts (3 tests) 2208ms
   ✓ session refresh (2)
     ✓ returns the profile and a fresh token for a signed-in user, so use keeps the session alive 951ms
     ✓ answers 401 once the account no longer exists 737ms
 ✓ tests/validation.test.ts (6 tests) 30ms
 ✓ tests/progress.test.ts (4 tests) 23ms
 ❯ tests/goal-bar.test.ts (1 test | 1 failed) 1530ms
   ❯ daily goal counts meals on the account timezone day (1)
     × counts a 01:00 local meal for today only once the account timezone matches the device 1098ms
 ✓ tests/brevo.test.ts (3 tests) 8ms
 ✓ tests/mailer.test.ts (2 tests) 11ms
 ✓ tests/test-helpers.test.ts (3 tests) 4ms
 ✓ tests/account-deletion.test.ts (1 test) 2143ms
   ✓ account deletion (1)
     ✓ removes the account and its meals without touching another account 1741ms
 ✓ tests/rewards.test.ts (9 tests) 12588ms
   ✓ reward points, unlocks and treats (7)
     ✓ starts with zero points and the free default theme 1891ms
     ✓ spends points on an unlock exactly once, however often it is repeated 1984ms
     ✓ refuses to spend below zero and changes nothing 1030ms
     ✓ cannot be tricked into overspending with simultaneous requests 2085ms
     ✓ sells a treat each time it is bought with a new purchase id, but never twice for the same purchase id 2169ms
     ✓ lets a theme or appearance option be chosen only after it is unlocked, and cleared again 1748ms
     ✓ keeps reward points separate from energy and from other accounts 1140ms

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯

 FAIL  tests/goal-bar.test.ts > daily goal counts meals on the account timezone day > counts a 01:00 local meal for today only once the account timezone matches the device
AssertionError: expected undefined to be 1 // Object.is equality

- Expected:
1

+ Received:
undefined

 ❯ tests/goal-bar.test.ts:35:73
     33|     const asUtc = await request(app).get('/api/progress').set('Authorization', auth);
     34|     const utcDays = asUtc.body.progress.lastSevenDays as { date: string; mealCount: number }[];
     35|     expect(utcDays.find((day) => day.date === '2026-10-24')?.mealCount).toBe(1); // counted on the UTC day: the mismatch
       |                                                                         ^
     36|
     37|     const patched = await request(app).patch('/api/profile').set('Authorization', auth).send({ timezone: 'Europe/Helsinki' });

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯


 Test Files  1 failed | 21 passed (22)
      Tests  1 failed | 157 passed (158)
   Start at  15:51:49
   Duration  14.04s (tests 83%, import 16%, transform 1%)
```
