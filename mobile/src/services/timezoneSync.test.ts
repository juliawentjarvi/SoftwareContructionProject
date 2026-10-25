import { describe, expect, it, vi } from "vitest";

vi.mock("react-native", () => ({ Platform: { OS: "web" } }));
vi.mock("expo-constants", () => ({ default: { expoConfig: null } }));
vi.mock("@react-native-async-storage/async-storage", () => ({ default: { getItem: vi.fn(), setItem: vi.fn(), removeItem: vi.fn() } }));

import type { Profile } from "./api";
import { syncTimezone } from "./timezoneSync";

const profile = (timezone: string): Profile => ({
	id: "1", email: "a@example.test", displayName: "A", timezone, dailyMealGoal: 3, stepTarget: null, notificationsEnabled: false, reminderTimes: ["08:00", "12:30", "18:30"],
});

describe("syncTimezone", () => {
	it("does nothing when the account already uses the device timezone", async () => {
		const updateProfile = vi.fn();
		const result = await syncTimezone("t", profile("Europe/Helsinki"), { updateProfile, deviceTimeZone: () => "Europe/Helsinki" });
		expect(result).toEqual({ changed: false });
		expect(updateProfile).not.toHaveBeenCalled();
	});

	it("saves the device timezone when it differs and returns the updated profile", async () => {
		const updated = profile("Europe/Helsinki");
		const updateProfile = vi.fn(async () => ({ ok: true as const, status: 200, body: { user: updated } }));
		const result = await syncTimezone("t", profile("UTC"), { updateProfile, deviceTimeZone: () => "Europe/Helsinki" });
		expect(result).toEqual({ changed: true, user: updated });
		expect(updateProfile).toHaveBeenCalledWith("t", { timezone: "Europe/Helsinki" });
	});

	it("reports a failed save without throwing, so sign-in is never blocked", async () => {
		const updateProfile = vi.fn(async () => ({ ok: false as const, status: 0, body: { message: "offline" } }));
		const result = await syncTimezone("t", profile("UTC"), { updateProfile, deviceTimeZone: () => "Asia/Tokyo" });
		expect(result).toEqual({ changed: false, failed: true });
	});
});
