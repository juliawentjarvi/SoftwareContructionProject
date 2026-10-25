/**
 * Feature switches. Device reminders are postponed (see specs/001-bear-care-experience/future_considerations.md):
 * while this is false, expo-notifications is never imported (it fails in Expo Go with a missing
 * ExpoTopicSubscriptionModule native module) and the reminder switches say reminders are not working yet.
 * Flip it to true only when working on notifications in a development build.
 */
export const features = {
	reminderDelivery: false,
};
