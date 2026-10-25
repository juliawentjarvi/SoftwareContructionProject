import { Platform } from "react-native";
import { features } from "../config/features";

const TOKEN_KEY = "bear-care-access-token";

/**
 * Keeps the access token in the device's secure storage so a reminder action can save a meal while the app is not open.
 * Nothing is stored on the web. Failures are swallowed: the action then falls back to opening the app.
 */
export async function saveAccessToken(token: string): Promise<void> {
	if (Platform.OS === "web" || !features.reminderDelivery) return; // only needed for reminder actions
	try {
		const SecureStore = await import("expo-secure-store");
		await SecureStore.setItemAsync(TOKEN_KEY, token);
	} catch {
		// Optional convenience only.
	}
}

export async function loadAccessToken(): Promise<string | null> {
	if (Platform.OS === "web" || !features.reminderDelivery) return null;
	try {
		const SecureStore = await import("expo-secure-store");
		return await SecureStore.getItemAsync(TOKEN_KEY);
	} catch {
		return null;
	}
}

export async function clearAccessToken(): Promise<void> {
	if (Platform.OS === "web") return;
	try {
		const SecureStore = await import("expo-secure-store");
		await SecureStore.deleteItemAsync(TOKEN_KEY);
	} catch {
		// Nothing stored, or storage unavailable.
	}
}
