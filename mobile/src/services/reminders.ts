import { Platform } from "react-native";
import { features } from "../config/features";
import { REMINDERS_NOT_READY_NOTE } from "./copy";
import { LOG_MEAL_ACTION, MEAL_CATEGORY } from "./notificationActions";

// Android keeps a channel's sound/importance from when it was first created, so changes need a new id.
const reminderChannelId = "meal-reminders-v2";
const MAX_REMINDERS = 8;

/** Shown wherever reminders are described: the app cannot override the device's notification controls. */
export const DEVICE_CONTROLS_NOTE = "Your device decides whether reminders appear, including during Do Not Disturb or Focus.";

export type ReminderSupport = { supported: true } | { supported: false; reason: "web" | "postponed"; message: string };

/** Whether this runtime can schedule device notifications, and if not, why. */
export function reminderSupport(): ReminderSupport {
	if (!features.reminderDelivery) return { supported: false, reason: "postponed", message: REMINDERS_NOT_READY_NOTE };
	if (Platform.OS === "web") {
		return { supported: false, reason: "web", message: "Meal reminders need the phone app. They can't be scheduled in a web browser." };
	}
	return { supported: true };
}

export function remindersAvailable(): boolean {
	return reminderSupport().supported;
}

let configured = false;

/**
 * One-time notification setup for the native app: show reminders even while the app is open, and register the
 * "Log a meal" action (a text field in the notification) on the reminder category.
 */
/** Forgets that setup ran (used by tests). */
export function resetNotificationSetup() {
	configured = false;
}

export async function configureNotifications(): Promise<void> {
	if (configured || !reminderSupport().supported) return;
	const Notifications = await import("expo-notifications");
	Notifications.setNotificationHandler({
		handleNotification: async () => ({
			shouldShowBanner: true,
			shouldShowList: true,
			// Android only shows the pop-up banner when a sound is allowed.
			shouldPlaySound: Platform.OS === "android",
			shouldSetBadge: false,
		}),
	});
	await Notifications.setNotificationCategoryAsync(MEAL_CATEGORY, [
		{
			identifier: LOG_MEAL_ACTION,
			buttonTitle: "Log a meal",
			textInput: { submitButtonTitle: "Save", placeholder: "What did you eat?" },
			options: { opensAppToForeground: false },
		},
	]);
	configured = true;
}

export type ReminderResult =
	| { ok: true }
	| { ok: false; reason: "unsupported" | "denied" | "error"; message: string };

const failure = (reason: "unsupported" | "denied" | "error", message: string): ReminderResult => ({ ok: false, reason, message });

/** Asks for notification permission (if needed) and schedules a daily notification at each time. Reports exactly what happened. */
export async function enableMealReminders(times: string[]): Promise<ReminderResult> {
	const support = reminderSupport();
	if (!support.supported) return failure("unsupported", support.message);

	let Notifications: typeof import("expo-notifications");
	try {
		Notifications = await import("expo-notifications");
		if (Platform.OS === "android") {
			await Notifications.setNotificationChannelAsync(reminderChannelId, {
				name: "Meal reminders",
				importance: Notifications.AndroidImportance.HIGH,
				sound: "default",
				vibrationPattern: [0, 250, 250, 250],
			});
		}
		await configureNotifications();
		let permission = await Notifications.getPermissionsAsync();
		if (!permission.granted) {
			if (permission.canAskAgain === false) {
				return failure("denied", "Notifications are turned off for Bear Care. Allow them in your device settings to use reminders.");
			}
			permission = await Notifications.requestPermissionsAsync();
		}
		if (!permission.granted) {
			return failure("denied", "Notification permission was not granted, so reminders are off. You can allow it in your device settings.");
		}
	} catch {
		return failure("error", "Notification permission couldn't be checked on this device. Reminders are off.");
	}

	try {
		await Notifications.cancelAllScheduledNotificationsAsync();
		for (const time of times.slice(0, MAX_REMINDERS)) {
			const [hour, minute] = time.split(":").map(Number);
			await Notifications.scheduleNotificationAsync({
				content: {
					title: "A gentle meal check-in",
					body: "Have you had something to eat? Take a pause and log your meal when it suits you.",
					data: { screen: "meals" },
					categoryIdentifier: MEAL_CATEGORY,
				},
				trigger: {
					type: Notifications.SchedulableTriggerInputTypes.DAILY,
					hour: hour!,
					minute: minute!,
					...(Platform.OS === "android" ? { channelId: reminderChannelId } : {}),
				},
			});
		}
		return { ok: true };
	} catch {
		// Do not leave a partial schedule behind.
		try { await Notifications.cancelAllScheduledNotificationsAsync(); } catch { /* nothing more to do */ }
		return failure("error", "Reminders couldn't be scheduled on this device, so they are off.");
	}
}

export async function disableMealReminders(): Promise<ReminderResult> {
	if (!reminderSupport().supported) return { ok: true }; // nothing can be scheduled here
	try {
		const Notifications = await import("expo-notifications");
		await Notifications.cancelAllScheduledNotificationsAsync();
		return { ok: true };
	} catch {
		return failure("error", "The scheduled reminders couldn't be cancelled on this device.");
	}
}
