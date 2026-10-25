import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { features } from "../config/features";
import api from "./api";
import { ActionDeps, ActionOutcome, handleNotificationResponse, NotificationResponseLike } from "./notificationActions";
import { loadAccessToken } from "./sessionVault";

const HANDLED_KEY = "bear-care-last-handled-notification";

export const realActionDeps: ActionDeps = {
	loadToken: loadAccessToken,
	createMeal: (token, name, mealType, eatenAt) => api.createMeal(token, name, mealType, undefined, eatenAt),
	loadHandled: async () => { try { return await AsyncStorage.getItem(HANDLED_KEY); } catch { return null; } },
	saveHandled: async (key) => { try { await AsyncStorage.setItem(HANDLED_KEY, key); } catch { /* best effort */ } },
};

/** Shows a short local notification, used to confirm or report what a reminder action did. */
async function say(title: string, body: string) {
	try {
		const Notifications = await import("expo-notifications");
		await Notifications.scheduleNotificationAsync({ content: { title, body }, trigger: null });
	} catch {
		// Feedback is a nicety; the meal log is the source of truth.
	}
}

/**
 * Listens for taps on reminders and answers to the "Log a meal" action, including one that launched the app.
 * `onOutcome` lets the screen react (open the meal log, show the bear's feed reaction).
 */
export function subscribeToNotificationResponses(onOutcome: (outcome: ActionOutcome) => void): () => void {
	if (Platform.OS === "web" || !features.reminderDelivery) return () => undefined;
	let cancelled = false;
	let subscription: { remove: () => void } | undefined;

	const apply = async (response: NotificationResponseLike) => {
		const outcome = await handleNotificationResponse(response, realActionDeps);
		if (cancelled) return;
		if (outcome.status === "logged") await say("Meal saved", `${outcome.name} is in your log.`);
		if (outcome.status === "failed") await say("Meal not saved", `${outcome.name} couldn't be saved. Open Bear Care and log it there.`);
		if (outcome.status === "needs-sign-in") await say("Sign in to save", "Open Bear Care and sign in, then log your meal.");
		onOutcome(outcome);
	};

	void (async () => {
		try {
			const Notifications = await import("expo-notifications");
			if (cancelled) return;
			subscription = Notifications.addNotificationResponseReceivedListener((response) => { void apply(response as NotificationResponseLike); });
			// The response that started the app, if any; clear it so it is not delivered again on the next launch.
			const initial = await Notifications.getLastNotificationResponseAsync();
			if (initial && !cancelled) {
				await apply(initial as NotificationResponseLike);
				await Notifications.clearLastNotificationResponseAsync();
			}
		} catch {
			// Notifications unavailable in this runtime.
		}
	})();

	return () => { cancelled = true; subscription?.remove(); };
}
