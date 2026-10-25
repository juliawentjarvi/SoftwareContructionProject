# Data Model: Bear Care Wellness Experience

This document describes product entities and their invariants independently of their storage
representation. Every account-owned record is private to its owner.

## Account Profile

| Field | Meaning and constraints |
|---|---|
| Account ID | Unique, stable identifier. |
| Email | Required, valid, normalized for case and surrounding whitespace; unique across accounts. |
| Password credential | Protected credential; raw passwords are never stored or returned. |
| Display name | Required, trimmed, and bounded in length. |
| Timezone | Valid IANA timezone taken from the device automatically at registration and refreshed whenever the app is used; there is no timezone setting. |
| Meal target | Positive whole number; no fixed 1–8 ceiling. |
| Step target | Positive whole number; separate from observed step progress. |
| Reminder preference | Enabled state and local times; the number of times always equals `min(meal target, 12)`. Times default from a meal-rhythm table. |
| Audio preference | Whether in-app music and sound effects are muted. |
| Profile picture | Optional user-selected image reference. |
| Reward balance | Non-negative integer derived from reward events. |
| Field version | Version information for mutable fields, used to detect stale edits to the same field. |
| Created/updated timestamps | Account lifecycle metadata. |

Notification permission is a device capability and MUST NOT be treated as a server guarantee that
a notification can be delivered.

## Meal Entry

| Field | Meaning and constraints |
|---|---|
| Meal ID | Unique entry identifier. |
| Owner account ID | Required; all operations are authorized against authenticated identity. |
| Name | Required, trimmed, non-empty, bounded text. |
| Meal type | Optional classification such as breakfast, lunch, dinner, or snack. |
| Eaten-at instant | Required unambiguous time; local entry is interpreted in the profile timezone. |
| Notes | Optional bounded text. |
| Created/updated timestamps | Entry lifecycle metadata. |
| Field version | Version information for mutable fields, used to detect stale edits to the same field. |

## Activity Entry

| Field | Meaning and constraints |
|---|---|
| Activity ID | Unique entry identifier. |
| Owner account ID | Required; all operations are authorized against authenticated identity. |
| Activity type | Required bounded description or category. |
| Occurred-at instant | Required unambiguous time, displayed in the profile timezone. |
| Step count | Optional non-negative integer; missing is distinct from zero or target met. |
| Notes | Optional bounded user text. |

## Daily Progress

Derived for one account and local calendar day from that day's meals, step entries, and targets.

- Meal count and target are calculated independently of step progress.
- Step total and target preserve missing-data state.
- A qualifying streak day requires both configured targets to be met.
- The meal energy display is fictional progress, based on the meal count and target.
- Bear health is playful feedback; two consecutive completed days below the meal target may lower
  the presentation, but it is not medical information.
- The incomplete current local day does not prematurely break a streak.
- Changing timezone changes local-day presentation without changing recorded instants.

## Reminder Preference

Belongs to one profile. Contains enabled state, selected local times, and schedule frequency.
Device permission and actual scheduling success are separately observable client state. Disabling
reminders cancels scheduled app reminders; re-enabling requires valid permission and a successful
schedule.

## Cached Client View

Represents previously fetched data retained for read-only viewing during a connection outage.
It has a last-refreshed timestamp and a freshness state. When disconnected, the app labels the
view as potentially stale. It does not queue new or changed records for later submission.

## Concurrent Update State

Profile and mutable record fields carry enough version information to detect stale edits to the
same field. The first update persists; a stale update to that same field is rejected and does not
replace newer data. Concurrent changes to different fields or records both persist. The client
refreshes before the user reapplies a conflicting field change.

## Password Reset Capability

Represents a time-limited, single-use credential sent to the account email. It is invalidated after
successful use or expiry, is not exposed by ordinary account endpoints, and is never logged in
plaintext.

## Reward Ledger and Sudoku Session

Each points award or spend is an immutable event associated with an account and a source game or
unlock. A game completion and an unlock reference can produce at most one corresponding ledger
event. Spending cannot reduce the account balance below zero. Replaying a completed session cannot
award points twice.

## Ownership and validation invariants

- Every private entity has an owner and is queried/mutated only with both entity identity and
  authenticated owner identity.
- Email uniqueness is case-insensitive after trimming, including concurrent registrations.
- Stored credentials are protected; ordinary responses never include credentials or reset tokens.
- Meal/activity instants remain stable when displayed in a different timezone.
- Meal and step targets are positive whole numbers; step counts and reward balance are non-negative.
- Missing step data never counts as meeting the step target.
- Account deletion removes or irreversibly detaches the account's private records according to the
  approved deletion behavior.
- Profile/record writes to the same field based on a stale value are rejected without changing the
  latest value; the client refreshes before the user reapplies the edit.
- Concurrent changes to distinct fields or records do not overwrite each other.
- Offline writes are not queued. Previously fetched data may be viewed only when identified as
  potentially stale and annotated with its last refresh time.

## Increment 2 additions (2026-10-25)

### Reminder schedule invariant

- `reminderTimes` holds exactly `min(dailyMealGoal, 12)` distinct `HH:mm` values in ascending order.
- Default for a new account (target 3): 08:00, 12:30, 18:30.
- Default rhythm: 1 -> 12:00; 2 -> 08:00, 18:00; 3 -> 08:00, 12:30, 18:30; 4 -> 08:00, 12:30, 15:30, 18:30;
  5 -> 08:00, 10:30, 12:30, 15:30, 18:30; 6 or more -> evenly spread from 07:30 to 21:00 in 5-minute steps.
- Changing the target: if the times still equal the default for the old target, regenerate the default for the new
  target; otherwise keep existing times, add the nearest unused rhythm times when growing, drop the latest times when
  shrinking.
- `notificationsEnabled` stays `false` while device reminders are postponed; it is a preference, never proof of
  delivery.

### Device-local preferences (not stored on the account)

| Preference | Meaning |
|---|---|
| Animate the bear | Boolean, default on. On = idle animations run regardless of the device's reduce-motion setting; off = no idle animations. Taps and feeding always react. |
| Saved API address | Optional override of the automatic server address. |

### Sign-in material on the device

The access token may be kept in secure storage only when device reminders are enabled for use (postponed). Log out
removes it and cancels any scheduled reminders.

### Password reset (dormant)

Reset code hash and expiry fields exist on the account but the routes are disabled unless `PASSWORD_RESET_ENABLED`
is true.
