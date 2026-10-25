export const PICTURE_SIZE = 256;
/** Same limit as the server: a small square picture of a few tens of kilobytes. */
export const MAX_PICTURE_BYTES = 120_000;

export const toDataUrl = (base64: string, mime = "image/jpeg") => `data:${mime};base64,${base64}`;

/** Size in bytes of base64 text once decoded. */
export function decodedBytes(base64: string): number {
	const padding = base64.endsWith("==") ? 2 : base64.endsWith("=") ? 1 : 0;
	return Math.floor((base64.length * 3) / 4) - padding;
}

export type PickResult =
	| { ok: true; dataUrl: string }
	| { ok: false; reason: "cancelled" | "too-large" | "error"; message: string };

/**
 * Let the person choose a photo, then cut it to a centred square and shrink it so it is small enough to store on the account.
 * Never throws: a cancelled pick is not an error, and a failure comes back as a message to show.
 */
export async function pickProfilePicture(): Promise<PickResult> {
	try {
		const ImagePicker = await import("expo-image-picker");
		const picked = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], allowsEditing: true, aspect: [1, 1], quality: 1 });
		const asset = picked.assets?.[0];
		if (picked.canceled || !asset) return { ok: false, reason: "cancelled", message: "" };

		const ImageManipulator = await import("expo-image-manipulator");
		const side = Math.min(asset.width, asset.height);
		const result = await ImageManipulator.manipulateAsync(
			asset.uri,
			[
				{ crop: { originX: Math.floor((asset.width - side) / 2), originY: Math.floor((asset.height - side) / 2), width: side, height: side } },
				{ resize: { width: PICTURE_SIZE, height: PICTURE_SIZE } },
			],
			{ compress: 0.7, format: ImageManipulator.SaveFormat.JPEG, base64: true },
		);
		if (!result.base64) return { ok: false, reason: "error", message: "The photo couldn't be prepared. Try another one." };
		if (decodedBytes(result.base64) > MAX_PICTURE_BYTES) return { ok: false, reason: "too-large", message: "That photo is still too large. Try a different one." };
		return { ok: true, dataUrl: toDataUrl(result.base64) };
	} catch {
		return { ok: false, reason: "error", message: "The photo couldn't be opened. Check that Bear Care may use your photos, then try again." };
	}
}
