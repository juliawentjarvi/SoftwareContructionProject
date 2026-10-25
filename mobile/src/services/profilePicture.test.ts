import { beforeEach, describe, expect, it, vi } from "vitest";

const picker = vi.hoisted(() => ({ launchImageLibraryAsync: vi.fn() }));
const manipulator = vi.hoisted(() => ({ manipulateAsync: vi.fn(), SaveFormat: { JPEG: "jpeg" } }));
vi.mock("expo-image-picker", () => picker);
vi.mock("expo-image-manipulator", () => manipulator);

import { MAX_PICTURE_BYTES, decodedBytes, pickProfilePicture, toDataUrl } from "./profilePicture";

beforeEach(() => vi.clearAllMocks());

describe("data URL helpers", () => {
	it("wraps base64 data and measures its decoded size", () => {
		expect(toDataUrl("QUJD")).toBe("data:image/jpeg;base64,QUJD");
		expect(decodedBytes("QUJD")).toBe(3); // "ABC"
		expect(decodedBytes("QUI=")).toBe(2);
		expect(decodedBytes("Qg==")).toBe(1);
	});
});

describe("pickProfilePicture", () => {
	it("reports cancelling without an error", async () => {
		picker.launchImageLibraryAsync.mockResolvedValue({ canceled: true, assets: null });
		expect(await pickProfilePicture()).toEqual({ ok: false, reason: "cancelled", message: "" });
		expect(manipulator.manipulateAsync).not.toHaveBeenCalled();
	});

	it("crops to a centred square, shrinks it, and returns a small JPEG data URL", async () => {
		picker.launchImageLibraryAsync.mockResolvedValue({ canceled: false, assets: [{ uri: "file://photo", width: 4000, height: 3000 }] });
		manipulator.manipulateAsync.mockResolvedValue({ base64: "QUJD" });

		const result = await pickProfilePicture();

		expect(result).toEqual({ ok: true, dataUrl: "data:image/jpeg;base64,QUJD" });
		const [uri, actions, options] = manipulator.manipulateAsync.mock.calls[0]!;
		expect(uri).toBe("file://photo");
		expect(actions[0]).toEqual({ crop: { originX: 500, originY: 0, width: 3000, height: 3000 } });
		expect(actions[1]).toEqual({ resize: { width: 256, height: 256 } });
		expect(options).toMatchObject({ base64: true, format: "jpeg" });
	});

	it("refuses an image that is still too large after shrinking", async () => {
		picker.launchImageLibraryAsync.mockResolvedValue({ canceled: false, assets: [{ uri: "file://p", width: 100, height: 100 }] });
		manipulator.manipulateAsync.mockResolvedValue({ base64: "A".repeat(Math.ceil((MAX_PICTURE_BYTES * 4) / 3) + 100) });
		expect(await pickProfilePicture()).toMatchObject({ ok: false, reason: "too-large" });
	});

	it("reports a failure to open or process the photo as an error, never a thrown exception", async () => {
		picker.launchImageLibraryAsync.mockRejectedValue(new Error("no permission"));
		expect(await pickProfilePicture()).toMatchObject({ ok: false, reason: "error" });
		picker.launchImageLibraryAsync.mockResolvedValue({ canceled: false, assets: [{ uri: "u", width: 10, height: 10 }] });
		manipulator.manipulateAsync.mockRejectedValue(new Error("bad image"));
		expect(await pickProfilePicture()).toMatchObject({ ok: false, reason: "error" });
	});
});
