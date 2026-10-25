import AsyncStorage from "@react-native-async-storage/async-storage";

const ANIMATE_KEY = "bear-care-animate";

/** Whether the bear's idle animations (breathing, blinking, ear waves, bored moves) run. On unless the user turns it off. */
export async function getAnimate(): Promise<boolean> {
	try {
		return (await AsyncStorage.getItem(ANIMATE_KEY)) !== "false";
	} catch {
		return true;
	}
}

export async function setAnimate(value: boolean): Promise<void> {
	try {
		await AsyncStorage.setItem(ANIMATE_KEY, String(value));
	} catch {
		// The preference is a convenience; failing to save it must not break settings.
	}
}
