import AsyncStorage from "@react-native-async-storage/async-storage";

const ALWAYS_ANIMATE_KEY = "bear-care-always-animate";

/** Whether the bear keeps its idle animations even when the device asks for reduced motion. */
export async function getAlwaysAnimate(): Promise<boolean> {
	try {
		return (await AsyncStorage.getItem(ALWAYS_ANIMATE_KEY)) === "true";
	} catch {
		return false;
	}
}

export async function setAlwaysAnimate(value: boolean): Promise<void> {
	try {
		await AsyncStorage.setItem(ALWAYS_ANIMATE_KEY, String(value));
	} catch {
		// The preference is a convenience; failing to save it must not break settings.
	}
}
