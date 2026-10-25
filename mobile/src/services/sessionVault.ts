import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

const TOKEN_KEY = "bear-care-access-token";

/**
 * Remembers the sign-in on this device so the app opens signed in until the person logs out.
 * Phones keep it in secure storage (Keychain / Keystore); the web has no secure storage, so the browser's local
 * storage is used there. Failures are swallowed: the worst case is being asked to sign in again.
 */
export async function saveAccessToken(token: string): Promise<void> {
	try {
		if (Platform.OS === "web") {
			await AsyncStorage.setItem(TOKEN_KEY, token);
			return;
		}
		const SecureStore = await import("expo-secure-store");
		await SecureStore.setItemAsync(TOKEN_KEY, token);
	} catch {
		// Not remembering the sign-in is acceptable; it only means signing in again next time.
	}
}

export async function loadAccessToken(): Promise<string | null> {
	try {
		if (Platform.OS === "web") return await AsyncStorage.getItem(TOKEN_KEY);
		const SecureStore = await import("expo-secure-store");
		return await SecureStore.getItemAsync(TOKEN_KEY);
	} catch {
		return null;
	}
}

export async function clearAccessToken(): Promise<void> {
	try {
		if (Platform.OS === "web") {
			await AsyncStorage.removeItem(TOKEN_KEY);
			return;
		}
		const SecureStore = await import("expo-secure-store");
		await SecureStore.deleteItemAsync(TOKEN_KEY);
	} catch {
		// Nothing stored, or storage unavailable.
	}
}
