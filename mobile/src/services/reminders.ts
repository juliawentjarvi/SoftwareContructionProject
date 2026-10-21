import { Platform } from "react-native";
import { isRunningInExpoGo } from "expo";

const reminderChannelId = "meal-reminders";

export function remindersAvailable(): boolean {
	return Platform.OS !== "web" && !isRunningInExpoGo();
}

export async function requestReminderPermission(): Promise<boolean> {
	if (!remindersAvailable()) return false;
	const Notifications = await import("expo-notifications");
	if (Platform.OS === "android") {
		await Notifications.setNotificationChannelAsync(reminderChannelId, {
			name: "Meal reminders",
			importance: Notifications.AndroidImportance.DEFAULT,
			sound: null,
		});
	}
	const permission = await Notifications.getPermissionsAsync();
	if (permission.granted) return true;
	const requested = await Notifications.requestPermissionsAsync();
	return requested.granted;
}

export async function scheduleMealReminders(times: string[]): Promise<void> {
	if (!remindersAvailable()) return;
	const Notifications = await import("expo-notifications");
	await Notifications.cancelAllScheduledNotificationsAsync();
	for (const [index, time] of times.entries()) {
		const [hour, minute] = time.split(":").map(Number);
		await Notifications.scheduleNotificationAsync({
			content: {
				title: "A gentle meal check-in",
				body: "Have you had something to eat? Take a pause and log your meal when it suits you.",
				data: { screen: "meals" },
			},
			trigger: {
				type: Notifications.SchedulableTriggerInputTypes.DAILY,
				hour: hour!,
				minute: minute!,
				...(Platform.OS === "android" ? { channelId: reminderChannelId } : {}),
			},
		});
		if (index >= 7) break;
	}
}

export async function clearMealReminders(): Promise<void> {
	if (!remindersAvailable()) return;
	const Notifications = await import("expo-notifications");
	await Notifications.cancelAllScheduledNotificationsAsync();
}