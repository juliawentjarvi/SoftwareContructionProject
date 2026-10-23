# Feature Specification: Bear Care Wellness Experience

**Feature Branch**: `review-baseline`

**Created**: 2026-10-23

**Status**: Draft

**Input**: User description: Build a cross-platform bear-care app for meal and activity logging, reminders, a goal-responsive pet, Sudoku, rewards, and customization, including the second-iteration account, settings, and interface changes.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Set up an account and log meals (Priority: P1)

A user creates an account with an email and password, sets a timezone and daily meal target, and decides whether to allow reminders. They can record meals with a name, time, and optional notes, including meals from earlier in the day. Their entries appear in a personal log so they can review what they have eaten.

**Why this priority**: An account, a usable meal log, and a configurable goal provide the core value of the app and establish the data needed by reminders and the bear.

**Independent Test**: Create an account, enter a meal with a past time and notes, and verify that it appears in the user's log with its time shown in the selected timezone.

**Acceptance Scenarios**:

1. **Given** an email address not already used by an account, **When** a user registers with a valid password, **Then** one account is created and the user can sign in.
2. **Given** an email address already associated with an account, **When** another registration is attempted with that email, **Then** no second account is created and the user receives a clear message.
3. **Given** a signed-in user, **When** they add a meal with a name, selected time, and optional notes, **Then** the meal appears in their log with the selected local date and time.
4. **Given** a user viewing their meal log, **When** they choose to record a meal from an earlier time, **Then** they can select its date and time and save it as a past entry.
5. **Given** a meal is saved, **When** the user returns to the home screen, **Then** a prompt offers to log another meal and disappears automatically after seven seconds.
6. **Given** a signed-in user, **When** they request a password reset for their account email, **Then** they receive a time-limited, single-use way to set a new password without revealing whether an unrelated email has an account.
7. **Given** a user sets a meal target greater than eight, **When** they save it, **Then** the app accepts the positive whole number and uses it to show daily progress.
8. **Given** two accounts have different owners, **When** either user views their profile and logs, **Then** they can access only their own records.
9. **Given** a user requests account deletion, **When** they confirm the clearly identified delete action, **Then** their account and personal logs are deleted and they are returned to the signed-out state.

---

### User Story 2 - Choose when to be reminded (Priority: P1)

A user who loses track of meals chooses a daily meal target and reminder times. They grant or decline notification permission through their device, can turn reminders on or off from the home screen or settings, and can record a meal directly from a reminder without navigating into the app.

**Why this priority**: Timely, user-controlled reminders address the primary need in the first user story while preserving the user's ability to avoid interruptions.

**Independent Test**: Enable reminders with device permission, verify a scheduled reminder, turn reminders off from the home screen, and verify that subsequent reminders are disabled. Where supported, record a meal from a reminder.

**Acceptance Scenarios**:

1. **Given** a user has not decided whether to receive reminders, **When** they enable reminders, **Then** the device requests notification permission before reminders are enabled.
2. **Given** reminders are enabled and permission is granted, **When** a selected reminder time arrives, **Then** the device presents a meal reminder.
3. **Given** reminders are enabled, **When** the user turns off the home-screen reminder toggle, **Then** the app saves the disabled setting and stops scheduling reminders.
4. **Given** a reminder is displayed on a platform that supports notification actions, **When** the user chooses to log a meal and enters its name, **Then** the meal is added to their log without requiring them to open the app.
5. **Given** device notification permission is denied or later withdrawn, **When** the user enables reminders, **Then** the app explains that device permission is needed and does not report reminders as active.
6. **Given** device quiet hours or Do Not Disturb are active, **When** a reminder is scheduled, **Then** the app respects the device's notification behavior and does not claim it can bypass those controls.
7. **Given** a user changes their reminder times or frequency in settings, **When** they save the changes, **Then** the home-screen toggle and settings show the same preference and reminders follow the updated schedule.
8. **Given** a user changes their timezone, **When** they view a previously saved meal, **Then** the meal is displayed in the newly selected timezone without changing the moment it was recorded.

---

### User Story 3 - Care for the bear and enjoy rewards (Priority: P2)

A user checks the home screen to see a bear, food bowl, Sudoku paper, meal progress, and a heart-shaped streak indicator. Logging meals advances the daily energy bar. The user can play Sudoku, earn points, feed the bear, and unlock appearance or environment options. A user who is not seeking meal reminders can still enjoy these activities.

**Why this priority**: The pet and optional play make the experience engaging, while remaining available to users who do not need reminders.

**Independent Test**: Log five meals against a five-meal target and verify the energy bar is full; start one Sudoku game and verify it drops by one tenth. Check step-point increments, Sudoku number-button states and conflict feedback, and the end-of-game result prompt.

**Acceptance Scenarios**:

1. **Given** a signed-in user on the home screen, **When** the screen opens, **Then** it shows the bear centrally, the food bowl on its left, the Sudoku entry on its right, energy and health indicators at the upper left, and the profile entry at the upper right.
2. **Given** a user has a daily meal target, **When** they log meals, **Then** the energy bar reflects their logged meal count as a proportion of that target.
3. **Given** a user reaches their meal and step targets for a day, **When** the day qualifies for streak progress, **Then** the streak heart advances through a pleasant rainbow color progression and animates with a heartbeat when the user enters the app.
4. **Given** the user has not reached their daily meal target for two consecutive completed days, **When** they view the bear, **Then** its playful health presentation decreases without presenting itself as a real health assessment.
5. **Given** a user opens the Sudoku game, **When** they complete a game, **Then** they receive points that can be spent on available treats or customization options.
6. **Given** a user has enough points for an available option, **When** they unlock it, **Then** they can apply the option to the bear or app environment.
7. **Given** a user taps the bear, **When** the bear responds, **Then** it performs one of these reactions, chosen at random: the right arm waves; the eyebrows lift and fall in a surprised expression; or both arms move in front of the eyes.
8. **Given** a user prefers a quiet experience, **When** they use the mute toggle, **Then** app music and sound effects are muted without changing meal records or reminder preferences.
9. **Given** a user records physical activity or step progress, **When** they view their log, **Then** their activity and step entries appear with their dates.
10. **Given** a user has not entered step progress, **When** they view daily goals and their streak, **Then** the app does not show the step target as met or award a qualifying streak day.
11. **Given** a user opens their profile on a supported mobile or desktop device, **When** they navigate the app's core flows, **Then** the account, logging, reminder settings, and pet progress remain usable.
12. **Given** a user selects an optional profile picture, **When** they save their profile, **Then** the profile displays that picture and the user can change or remove it.
13. **Given** a user has a daily meal target, **When** they log a meal, **Then** their daily energy balance increases by 10 energy points and the energy bar updates against a target of 10 energy points per planned meal.
14. **Given** a user records steps, **When** each additional full 1,000-step interval is reached that day, **Then** their daily energy balance increases by 5 energy points per interval.
15. **Given** a Sudoku game is started, **When** the game begins, **Then** 5 energy points are deducted once for that game; a five-meal target with five logged meals and no steps therefore goes from a full energy bar to 90%.
16. **Given** a Sudoku board is active, **When** a digit has already been entered once in each of the nine 3x3 boxes, **Then** that digit's number button is muted and cannot be selected.
17. **Given** a user places a digit that duplicates another entry in the same row or 3x3 box, **When** the board validates the entry, **Then** the conflicting entry is shown in red. Standard Sudoku column conflicts are also shown in red.
18. **Given** every Sudoku cell is filled, **When** the board checks the completed solution, **Then** it reports a win if the solution is correct or reports that an entry is incorrect and offers a way to continue correcting the current board.
19. **Given** the user is on the home screen with no interaction, **When** time passes, **Then** the bear blinks at irregular intervals and, at random moments, waves one randomly chosen ear (left or right).
20. **Given** the user has been in the app for a while without interacting with the bear, **When** the bear becomes "bored", **Then** it performs one of: waving both arms while bending its knees a few times, or "kicking sand" with small waving motions of lowered arms.
21. **Given** the user saves a meal, **When** they return to the home screen, **Then** the bear jumps and waves, and hearts pop up around it and disappear.
22. **Given** the user taps the Sudoku entry, **When** the entry is activated, **Then** the bear performs one of the tap reactions from scenario 7.
23. **Given** the device is set to reduce motion, **When** the home screen is shown, **Then** idle and bored animations do not run and any reaction is brief and non-looping.

### Edge Cases

- A registration attempt uses an email that already belongs to an account, including different capitalization or surrounding whitespace.
- A password-reset request is made for an email that is unknown, expired, or has already used its reset option.
- The user denies notification permission, disables permission in device settings, or uses a device that does not support a notification action.
- A user changes timezone or enters a meal around midnight; previously recorded meals retain their correct moment while being displayed in the selected timezone.
- A meal is logged after the day it occurred, or the user edits a time using the hour and minute controls.
- The user has no meal entries, has a meal target above the former preset range, or sets an invalid or empty target.
- The user changes their target during a day or misses the target for two consecutive completed days.
- Step information is unavailable or not entered; the app does not claim that the step target was met.
- Step totals cross one or multiple 1,000-step boundaries, decrease after an edit, or are entered after a Sudoku game has started.
- Daily energy falls below zero after Sudoku costs or exceeds the meal-target amount due to movement points.
- A user has too few points to unlock an option, or tries to spend points more than once for the same unlock.
- A Sudoku digit is present in some but not all 3x3 boxes, appears more than once in a row/column/box, or a completed board contains an incorrect digit.
- A Sudoku game is opened and abandoned, or its final incorrect board is continued and corrected.
- The user loses connectivity while a read or write is in progress, times out, or receives a response after retrying.
- A request succeeds on the server but its response is lost; retrying must not create a duplicate meal, activity, game charge, or reward.
- Two sessions update the same profile field or record at nearly the same time, or update separate fields/records concurrently.
- The app displays previously loaded data while offline, or has no cached copy of a requested screen.
- The app is used for an extended session with repeated navigation and repeated connection failures.
- The user turns reminders off and later on again, or has reminders disabled while changing reminder times.
- The user deletes their account; their private profile and log are no longer accessible through that account.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The app MUST allow users to create an account and sign in using an email address and password.
- **FR-002**: The app MUST treat email addresses without regard to letter case or surrounding whitespace when checking for duplicate accounts.
- **FR-003**: The app MUST prevent multiple accounts from being created with the same email address.
- **FR-004**: The app MUST store account profile information, including the email, a securely protected password credential, the user's calibration and notification preferences.
- **FR-005**: The app MUST provide a password-reset flow that sends a time-limited, single-use reset option to the account email and does not disclose account existence in the request response.
- **FR-006**: The app MUST allow a user to set a timezone during registration and change it later in settings.
- **FR-007**: The app MUST allow users to choose a positive whole-number daily meal target without limiting input to a fixed set of preset values.
- **FR-008**: The app MUST let users create, review, and delete their own food log entries, each containing a meal name, meal time, and optional notes.
- **FR-009**: The app MUST allow users to enter or edit a meal's date and time, including past meal times, using clearly labeled hour and minute selection.
- **FR-010**: The app MUST display meal dates and times in the user's selected timezone.
- **FR-011**: After a meal is saved, the app MUST return the user to the home screen and show an offer to log another meal; the offer MUST disappear after seven seconds.
- **FR-012**: The app MUST let users record physical activity and step progress in a log that is accessible to that user.
- **FR-013**: The app MUST let users set and change their step target, and MUST distinguish missing step information from a completed target.
- **FR-014**: The app MUST ask for device notification permission before activating reminders, and MUST clearly indicate when permission is unavailable or denied.
- **FR-015**: The app MUST let users select reminder times and adjust how frequently meal reminders are suggested.
- **FR-016**: The app MUST provide a prominent home-screen reminder toggle and a corresponding setting that enable and disable device meal reminders consistently.
- **FR-017**: The app MUST offer a meal-logging action in reminders and, where supported by the device, allow the user to enter a meal name and save it without opening the app.
- **FR-018**: The app MUST respect device notification controls, including Do Not Disturb, and MUST NOT imply that a user can grant the app authority to bypass them.
- **FR-019**: The home screen MUST display a bear, food bowl, Sudoku entry, meal energy bar, health indicator, and profile entry in the requested relative arrangement.
- **FR-020**: The app MUST update the energy bar in proportion to logged meals and the user's daily meal target.
- **FR-021**: The app MUST provide a playful bear health state that decreases when the user misses their meal target on two consecutive completed days, without presenting the state as medical information.
- **FR-022**: The app MUST provide a heart-shaped streak indicator that progresses through a pleasant rainbow gradient for consecutive days when the meal and step targets are met.
- **FR-023**: The streak heart MUST animate with a heartbeat when the user enters the app.
- **FR-024**: When the bear is tapped it MUST perform one randomly chosen reaction: the right arm waves, the eyebrows lift and fall in a surprised expression, or both arms move in front of the eyes.
- **FR-025**: The app MUST offer Sudoku as an optional game and award points for completing a game.
- **FR-026**: The app MUST allow points to unlock and obtain available bear treats, appearance options, and environment themes.
- **FR-027**: The app MUST let users choose available backgrounds and music, and provide a mute control for app music and sound effects.
- **FR-028**: Muting app audio MUST NOT disable meal reminders or change the user's notification setting.
- **FR-029**: The profile MUST provide access to settings and an optional profile picture.
- **FR-030**: Settings MUST provide account deletion through a clearly identified, small red action and require confirmation before deletion.
- **FR-031**: The app MUST be usable on supported mobile phones and desktop devices, and document how users can open it on those platforms.
- **FR-032**: The app MUST keep each user's profile, food log, activity log, and progress private from other users.
- **FR-033**: The app MUST not describe meal or step targets, bear energy, or bear health states as medical advice or a diagnosis.
- **FR-034**: The app MUST award 10 daily energy points for each meal logged for that local calendar day.
- **FR-035**: The app MUST award 5 daily energy points for each completed 1,000-step interval recorded for that local calendar day; partial intervals MUST NOT earn points.
- **FR-036**: The energy bar's full target MUST equal 10 energy points multiplied by the user's daily meal target. Its displayed fill MUST be clamped between empty and full, with excess points not displaying above full.
- **FR-037**: The app MUST deduct 5 energy points when a Sudoku game starts, at most once per game. The daily energy balance MAY fall below zero; the bar MUST display empty while it is negative, and later earnings MUST first offset the negative balance.
- **FR-038**: The app MUST reset daily energy points at the start of each local calendar day in the user's selected timezone. Corrections or deletions to a meal or step entry MUST recalculate that day's earned energy points.
- **FR-039**: The app MUST distinguish daily energy points from reward points used to unlock treats and customization; spending energy to start Sudoku MUST NOT spend reward points.
- **FR-040**: In Sudoku, the app MUST mute and disable a digit button when that digit has already been entered in each of the nine 3x3 boxes on the current board.
- **FR-041**: The Sudoku board MUST mark conflicting entered digits in red when a digit occurs more than once in the same row, column, or 3x3 box.
- **FR-042**: When all Sudoku cells are filled, the app MUST check the solution and display a win result for a correct solution or an incorrect-entry result with an option to continue the current game for correction.
- **FR-043**: The Sudoku game MUST charge its energy cost only once when a game starts; resuming or continuing that same game MUST NOT charge again.
- **FR-044**: Authentication, authorization, and input validation for protected data MUST be enforced by the backend and MUST NOT rely solely on client-side checks.
- **FR-045**: The app MUST present loading, success, and failure states for network-dependent operations; a failed or uncertain request MUST NOT be presented as successful.
- **FR-046**: The app MUST preserve user-entered form data when a network-dependent action fails, where that data remains available in the current session.
- **FR-047**: Retrying an operation intended to happen once MUST NOT create duplicate records, energy charges, or reward actions. A write whose outcome is uncertain MUST be safely deduplicated or require the user to inspect/retry explicitly without a false success state.
- **FR-048**: When previously fetched data is shown while disconnected, the app MUST visibly identify it as potentially stale and show when it was last refreshed. The app MUST NOT imply that stale data is current.
- **FR-049**: Offline use MUST be explicitly limited to viewing previously loaded data, when available. New or changed records MUST NOT be queued or reported as saved while offline; the user can retry after connectivity returns.
- **FR-050**: The backend MUST prevent one user's account, records, settings, or session from being exposed to or overwritten by another user or session.
- **FR-051**: Concurrent updates MUST detect conflicts at the field level. When two sessions edit the same field from the same prior value, the first update MUST persist and the later stale update MUST be rejected with a recoverable conflict response. Concurrent changes to different fields or records MUST both persist without overwriting each other.
- **FR-052**: The app MUST NOT exhibit a reproducible crash during the defined normal-use, slow-network, interrupted-network, and unavailable-network validation scenarios.
- **FR-053**: Repeated navigation and normal use MUST NOT cause unbounded memory growth.
- **FR-054**: Backend queries and responses MUST be measured under the defined expected workload; optimization MUST target measured bottlenecks without changing user-visible behavior.
- **FR-055**: Performance verification MUST record test conditions, response-time percentiles, request failure rate, resource usage, device/runtime, and any unmet targets or platform limitations.
- **FR-056**: The bear MUST be rendered from the supplied SVG artwork (`mobile/assets/bear/bear.svg`), animated by moving its named parts (such as `leftEye`, `rightEye`, `eyebrows`, `leftEar`, `rightEar`, `leftArm`, `rightArm`, `leftLeg`, `rightLeg`, `Body`, `head`, and `heart_emotes`) independently, on both mobile and web.
- **FR-057**: The bear MUST follow basic rules of autonomy: while the home screen is visible it MUST blink at irregular intervals and MUST at random intervals wave one of its ears, chosen at random between left and right.
- **FR-058**: After the user has been in the app for a while without interacting with the bear, the bear MUST occasionally perform a bored behavior, chosen at random: waving both arms while bending its knees a few times, or "kicking sand" with small waving motions of lowered arms.
- **FR-059**: When a meal is saved (the bear is fed), the bear MUST jump and wave, and hearts MUST pop up near it and then disappear.
- **FR-060**: When the Sudoku entry is selected, the bear MUST perform one of the tap reactions in FR-024.
- **FR-061**: Bear animations MUST NOT block interaction, MUST NOT overlap in a way that distorts the artwork (a new reaction replaces a running reaction of the same kind), and MUST stop when the home screen is not visible. When the device requests reduced motion, idle and bored animations MUST NOT run.

### Key Entities *(include if feature involves data)*

- **Account profile**: A user's unique email, protected sign-in credential, display name, optional picture, timezone, meal and step targets, notification preference, reminder schedule, and audio preference.
- **Meal entry**: A user's meal name, selected date and time, optional notes, and relationship to the account that recorded it.
- **Activity entry**: A user's recorded physical activity or step progress, date, and relationship to the account that recorded it.
- **Daily progress**: The user's meal and step totals, targets, energy-point balance and bar, target-completion state, and streak for a calendar day in the user's timezone.
- **Energy points**: Daily balance increased by meals and completed step intervals and decreased when Sudoku games start; distinct from spendable reward points.
- **Bear and rewards**: The bear's appearance and playful state, available and unlocked customizations, separate reward-point balance, and available treats.
- **Reminder**: A user's selected reminder times and frequency, permission state, and whether reminders are enabled.
- **Sudoku game**: A playable puzzle session, its one-time energy cost, board validation state, completion result, and any reward points earned when completed.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: At least 90% of first-time users in a usability test can create an account, set a meal target, and save a first meal within three minutes.
- **SC-002**: At least 90% of users in a usability test can record a meal from the log, including a past time, in under 30 seconds.
- **SC-003**: In testing on devices that support notification actions, at least 90% of users can log a meal from a reminder without opening the app.
- **SC-004**: In testing, turning reminders off from either the home screen or settings disables future app reminders, and turning them back on restores the selected schedule when device permission is granted.
- **SC-005**: In testing, every account can view only its own profile, meal entries, activity entries, and progress.
- **SC-006**: In usability testing, at least 90% of users can identify their meal progress, streak status, and the path to Sudoku or settings from the home screen without assistance.
- **SC-007**: In testing, every qualifying consecutive day advances the streak heart's rainbow progression, and entering the app triggers its heartbeat animation.
- **SC-008**: Users can use the core account, logging, reminder-setting, and pet-progress flows on both documented mobile and desktop platforms.
- **SC-009**: For a five-meal daily target, five logged meals with no steps fill the energy bar to 100%; starting one Sudoku game reduces it to 90%.
- **SC-010**: Every completed 1,000-step interval adds exactly 5 energy points, while fewer than 1,000 additional steps add none.
- **SC-011**: Starting a Sudoku game deducts exactly 5 energy points once, and continuing the same game never deducts a second time.
- **SC-012**: In Sudoku validation, digits duplicated in a row, column, or 3x3 box are visibly red; a fully correct board displays a win result and an incorrect full board offers continuation.
- **SC-013**: On representative supported devices under normal conditions, the main screen becomes usable within 3 seconds in at least 95% of 20 measured launches.
- **SC-014**: Across at least 100 measured common interactions and 100 common screen transitions per representative device/runtime, at least 95% of interactions provide visible feedback within 100 ms and at least 95% of transitions complete within 300 ms, excluding time spent waiting for required network responses.
- **SC-015**: Under the defined expected workload and normal network conditions, at least 95% of ordinary backend requests complete within 1 second as measured from the client.
- **SC-016**: In a five-minute test with 25 concurrent users, each making up to 12 ordinary requests per minute, the backend maintains SC-015 and produces zero cross-user data exposure or unintended overwrites.
- **SC-017**: During a 30-minute normal-use and error-handling session with at least 500 screen transitions and injected slow, interrupted, and unavailable network cases, the app has zero reproducible crashes and no sustained upward memory-use trend after warm-up.
- **SC-018**: In every tested network failure scenario, failed operations are not shown as successful, form input remains available where applicable, stale cached content is identified, and retrying a single-action write creates at most one resulting record or action.
- **SC-019**: Concurrent stale edits to the same field are detected in every conflict test; the latest saved value remains intact and the rejected editor can refresh and retry. Concurrent edits to different fields or records both persist.
- **SC-020**: On representative physical devices and in Expo Go where supported, the recorded test report includes the device/runtime, network conditions, latency percentiles, failure rate, resource observations, and unsupported capabilities.
- **SC-021**: In testing on a supported phone (Expo Go) and a desktop browser, each bear behavior (tap reaction variants, blink, ear wave, both bored behaviors, feed jump with hearts, Sudoku reaction) can be triggered or observed within five minutes of normal use, and the bear returns to its resting pose afterwards.
- **SC-022**: During bear animation, interactions elsewhere on the home screen still give feedback within 100 ms (SC-014).

## Assumptions

- Desktop support means the app can be opened and used on a desktop device; a separate downloadable desktop installation is not required.
- Device notification permission is required for reminders. The app cannot bypass Do Not Disturb, Focus, or other device-level notification controls.
- Notification actions depend on device support. If an action is unavailable, users can open the app and log the meal there.
- The step target and progress are entered by the user. Automatic collection from a wearable or phone health service is outside this feature.
- A user's meal target is any positive whole number; the previous fixed range of one to eight is not used. The target applies to the user's local calendar day.
- The seven-second post-save prompt offers to begin another meal entry; it does not discard or delay the saved meal.
- A missed meal target means fewer logged meals than the user's target on a completed local calendar day. The bear's health appearance is fictional feedback, not a clinical assessment.
- A qualifying streak day requires both the daily meal target and step target to be met. If step progress is missing, the day does not qualify.
- The energy balance is per local calendar day. The energy bar target is 10 points per planned meal; steps can raise the balance above the target, but the displayed bar remains full.
- Step points are awarded per complete 1,000-step interval, not proportionally for partial intervals. If a step entry changes, the day's step points are recalculated from its current total.
- Sudoku costs 5 energy points at game start, even if the user later abandons the game. Resuming or correcting that same game does not charge again. The energy balance may become negative; future meal and step points offset the deficit before the bar refills.
- Meal/step energy points are separate from reward points. Completing a Sudoku game may award reward points for customization; the energy cost does not consume reward points.
- Each Sudoku digit may appear at most once in each 3x3 box, row, and column in a valid solution. A digit button is disabled only after that digit has been entered in every 3x3 box on the board.
- Normal-performance measurements use a stable network with round-trip latency up to 100 ms and packet loss below 1%. Expected backend workload is 25 concurrent users, each making up to 12 ordinary requests per minute for five minutes.
- Representative device coverage includes at least one supported mid-range physical mobile device and one supported desktop browser; results are reported separately by device/runtime.
- Concurrent updates use field-level conflict detection: the first update to a field is saved, and a later update based on an older value for that same field is rejected with a recoverable conflict rather than silently overwriting the new value. Concurrent changes to different fields or records both persist. The user refreshes before reapplying a conflicting field change.
- Offline mode does not support creating or editing records. Previously loaded screens may remain viewable only with a clear stale-data indicator; writes wait for the user to reconnect and retry.
- The 30-minute stability scenario includes at least 500 common screen transitions and repeated network failure/recovery cycles; resource growth is assessed after initial warm-up on the same device and runtime.
- Reminder frequency and selected times are user-controlled. A one-hour follow-up reminder is not sent unless the user selects a schedule that includes it.
- The app's mute control applies to in-app music and sound effects, not device notification sounds.
- Account recovery is available only when the user can access the email address associated with the account.
- Food and activity entries are private personal records; the app does not provide dietary or medical advice.
- The bear's autonomous behaviors are playful and random, not tied to health or meal data; their frequency is tuned for testing (blink every few seconds, ear wave every ~8–20 s, bored behavior after ~30 s of no interaction) and may be adjusted without changing this specification.
- Feeding means saving a meal entry; the feed reaction plays when the user returns to the home screen after saving.
