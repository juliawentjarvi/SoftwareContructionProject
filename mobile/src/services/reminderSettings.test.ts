import { describe, expect, it, vi } from "vitest";

vi.mock("react-native", () => ({ Platform: { OS: "ios" } }));
vi.mock("@react-native-async-storage/async-storage", () => ({ default: { getItem: vi.fn(), setItem: vi.fn(), removeItem: vi.fn() } }));
vi.mock("expo-constants", () => ({ default: { expoConfig: null } }));

import type { Profile } from "./api";
import { checkReminderTimes, ReminderDeps, saveReminderTimes, setRemindersEnabled } from "./reminderSettings";

const profile = (overrides: Partial<Profile> = {}): Profile => ({
	id: "1", email: "a@example.test", displayName: "A", timezone: "UTC", dailyMealGoal: 3, stepTarget: null, selectedTheme: "meadow", selectedAccessory: null, hasProfilePicture: false,
	notificationsEnabled: false, reminderTimes: ["09:00", "13:00"], ...overrides,
});
const saved = (user: Profile) => ({ ok: true as const, status: 200, body: { user } });
const rejected = { ok: false as const, status: 0, body: { message: "offline" } };

type Mocked = { updateProfile: ReturnType<typeof vi.fn>; enable: ReturnType<typeof vi.fn>; disable: ReturnType<typeof vi.fn> };

function deps(overrides: Partial<Mocked> = {}): ReminderDeps & Mocked {
	return {
		updateProfile: vi.fn(async (_token: string, changes: Partial<Profile>) => saved(profile(changes))),
		enable: vi.fn(async () => ({ ok: true as const })),
		disable: vi.fn(async () => ({ ok: true as const })),
		...overrides,
	} as unknown as ReminderDeps & Mocked;
}

describe("turning reminders on", () => {
	it("schedules the device first, then saves, and reports the saved profile", async () => {
		const d = deps();
		const result = await setRemindersEnabled("t", profile(), true, d);
		expect(result).toMatchObject({ ok: true, user: { notificationsEnabled: true } });
		expect(d.enable).toHaveBeenCalledWith(["09:00", "13:00"]);
		expect(d.updateProfile).toHaveBeenCalledWith("t", { notificationsEnabled: true });
	});

	it("does not save or report reminders as on when the device cannot schedule them", async () => {
		const d = deps({ enable: vi.fn(async () => ({ ok: false, reason: "denied", message: "Permission was not granted." })) });
		const result = await setRemindersEnabled("t", profile(), true, d);
		expect(result).toEqual({ ok: false, message: "Permission was not granted." });
		expect(d.updateProfile).not.toHaveBeenCalled();
	});

	it("switches a previously saved 'on' preference back off when the device can no longer schedule", async () => {
		const d = deps({ enable: vi.fn(async () => ({ ok: false, reason: "denied", message: "Permission was revoked." })) });
		const result = await setRemindersEnabled("t", profile({ notificationsEnabled: true }), true, d);
		expect(result).toMatchObject({ ok: false, user: { notificationsEnabled: false } });
	});

	it("undoes the device schedule when saving the preference fails", async () => {
		const d = deps({ updateProfile: vi.fn(async () => rejected) });
		const result = await setRemindersEnabled("t", profile(), true, d);
		expect(result.ok).toBe(false);
		expect(d.disable).toHaveBeenCalled();
	});
});

describe("turning reminders off", () => {
	it("cancels the device schedule and saves the preference", async () => {
		const d = deps();
		const result = await setRemindersEnabled("t", profile({ notificationsEnabled: true }), false, d);
		expect(result).toMatchObject({ ok: true, user: { notificationsEnabled: false } });
		expect(d.disable).toHaveBeenCalled();
	});

	it("keeps reminders on and explains when cancelling fails", async () => {
		const d = deps({ disable: vi.fn(async () => ({ ok: false, reason: "error", message: "Couldn't cancel." })) });
		const result = await setRemindersEnabled("t", profile({ notificationsEnabled: true }), false, d);
		expect(result).toEqual({ ok: false, message: "Couldn't cancel." });
		expect(d.updateProfile).not.toHaveBeenCalled();
	});

	it("restores the device schedule when saving 'off' fails, so both stay on", async () => {
		const d = deps({ updateProfile: vi.fn(async () => rejected) });
		const result = await setRemindersEnabled("t", profile({ notificationsEnabled: true }), false, d);
		expect(result.ok).toBe(false);
		expect(d.enable).toHaveBeenCalledWith(["09:00", "13:00"]);
	});
});

describe("changing reminder times", () => {
	it("saves the times and reschedules only when reminders are on", async () => {
		const off = deps();
		expect(await saveReminderTimes("t", profile(), ["08:00"], off)).toMatchObject({ ok: true, user: { reminderTimes: ["08:00"] } });
		expect(off.enable).not.toHaveBeenCalled();

		const on = deps();
		await saveReminderTimes("t", profile({ notificationsEnabled: true }), ["08:00", "20:00"], on);
		expect(on.enable).toHaveBeenCalledWith(["08:00", "20:00"]);
	});

	it("reports a failed save without touching the schedule", async () => {
		const d = deps({ updateProfile: vi.fn(async () => rejected) });
		const result = await saveReminderTimes("t", profile({ notificationsEnabled: true }), ["08:00"], d);
		expect(result.ok).toBe(false);
		expect(d.enable).not.toHaveBeenCalled();
	});

	it("turns reminders off and says so when the new schedule cannot be set on the device", async () => {
		const d = deps({ enable: vi.fn(async () => ({ ok: false, reason: "error", message: "Couldn't schedule." })) });
		const result = await saveReminderTimes("t", profile({ notificationsEnabled: true }), ["08:00"], d);
		expect(result).toMatchObject({ ok: false, message: expect.stringContaining("reminders are off"), user: { notificationsEnabled: false } });
	});
});

describe("checking typed reminder times", () => {
	it("accepts one to eight different 24-hour times and trims them", () => {
		expect(checkReminderTimes([" 08:00", "20:15 "])).toEqual({ ok: true, times: ["08:00", "20:15"] });
		expect(checkReminderTimes(["07:00"]).ok).toBe(true);
		expect(checkReminderTimes(Array.from({ length: 8 }, (_, i) => `0${i}:00`)).ok).toBe(true);
	});

	it("explains what to fix for bad, duplicate, missing or too many times", () => {
		expect(checkReminderTimes(["9:00"])).toMatchObject({ ok: false, message: expect.stringContaining("24-hour") });
		expect(checkReminderTimes(["24:00"]).ok).toBe(false);
		expect(checkReminderTimes([])).toMatchObject({ ok: false });
		expect(checkReminderTimes(Array.from({ length: 9 }, (_, i) => `0${i}:00`))).toMatchObject({ ok: false });
		expect(checkReminderTimes(["09:00", "09:00"])).toEqual({ ok: false, message: "Each reminder needs a different time." });
	});
});
