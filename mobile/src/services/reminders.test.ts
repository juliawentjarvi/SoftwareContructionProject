import { beforeEach, describe, expect, it, vi } from "vitest";

const runtime = vi.hoisted(() => ({ os: "ios" }));
const notifications = vi.hoisted(() => ({
	getPermissionsAsync: vi.fn(),
	requestPermissionsAsync: vi.fn(),
	cancelAllScheduledNotificationsAsync: vi.fn(async () => undefined),
	scheduleNotificationAsync: vi.fn(async (_request?: unknown) => "id"),
	setNotificationChannelAsync: vi.fn(async (_id?: unknown, _channel?: unknown) => undefined),
	setNotificationHandler: vi.fn(),
	setNotificationCategoryAsync: vi.fn(async (_id?: unknown, _actions?: unknown) => []),
	AndroidImportance: { DEFAULT: 3 },
	SchedulableTriggerInputTypes: { DAILY: "daily" },
}));

vi.mock("react-native", () => ({ Platform: { get OS() { return runtime.os; } } }));
vi.mock("expo-notifications", () => notifications);

import { features } from "../config/features";
import { disableMealReminders, enableMealReminders, reminderSupport, resetNotificationSetup } from "./reminders";

beforeEach(() => {
	runtime.os = "ios";
	features.reminderDelivery = true;
	vi.clearAllMocks();
	resetNotificationSetup();
	notifications.getPermissionsAsync.mockResolvedValue({ granted: true, canAskAgain: true });
	notifications.requestPermissionsAsync.mockResolvedValue({ granted: true });
	notifications.cancelAllScheduledNotificationsAsync.mockResolvedValue(undefined);
	notifications.scheduleNotificationAsync.mockResolvedValue("id");
});

describe("reminder support", () => {
	it("explains that web cannot schedule reminders, and never touches notifications there", async () => {
		runtime.os = "web";
		expect(reminderSupport()).toMatchObject({ supported: false, reason: "web" });
		expect(await enableMealReminders(["09:00"])).toMatchObject({ ok: false, reason: "unsupported" });
		expect(notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
		expect(await disableMealReminders()).toEqual({ ok: true });
	});

	it("is supported on phones, including in Expo Go where local notifications still work", () => {
		expect(reminderSupport()).toEqual({ supported: true });
		runtime.os = "android";
		expect(reminderSupport()).toEqual({ supported: true });
	});
});

describe("enabling reminders", () => {
	it("schedules one daily notification per time, replacing any earlier schedule", async () => {
		const result = await enableMealReminders(["08:30", "13:00", "19:45"]);

		expect(result).toEqual({ ok: true });
		expect(notifications.cancelAllScheduledNotificationsAsync).toHaveBeenCalledTimes(1);
		expect(notifications.scheduleNotificationAsync).toHaveBeenCalledTimes(3);
		expect(notifications.scheduleNotificationAsync.mock.calls[1]![0]).toMatchObject({ trigger: { type: "daily", hour: 13, minute: 0 } });
		expect(notifications.requestPermissionsAsync).not.toHaveBeenCalled();
	});

	it("shows reminders while the app is open and offers a text 'Log a meal' action on the reminder category", async () => {
		await enableMealReminders(["09:00"]);

		expect(notifications.setNotificationHandler).toHaveBeenCalled();
		const [categoryId, actions] = notifications.setNotificationCategoryAsync.mock.calls[0]!;
		expect(categoryId).toBe("meal-reminder");
		expect(actions).toEqual([expect.objectContaining({ identifier: "log-meal", textInput: expect.any(Object), options: { opensAppToForeground: false } })]);
		expect(notifications.scheduleNotificationAsync.mock.calls[0]![0]).toMatchObject({ content: { categoryIdentifier: "meal-reminder" } });
	});

	it("uses a high-importance Android channel so reminders make a sound and pop up", async () => {
		runtime.os = "android";
		await enableMealReminders(["09:00"]);
		expect(notifications.setNotificationChannelAsync.mock.calls[0]![1]).toMatchObject({ sound: "default" });
		expect(notifications.scheduleNotificationAsync.mock.calls[0]![0]).toMatchObject({ trigger: { channelId: "meal-reminders-v2" } });
	});

	it("asks for permission when it has not been granted and proceeds only if the user allows it", async () => {
		notifications.getPermissionsAsync.mockResolvedValue({ granted: false, canAskAgain: true });
		notifications.requestPermissionsAsync.mockResolvedValue({ granted: true });
		expect(await enableMealReminders(["09:00"])).toEqual({ ok: true });
		expect(notifications.requestPermissionsAsync).toHaveBeenCalledTimes(1);

		vi.clearAllMocks();
		notifications.getPermissionsAsync.mockResolvedValue({ granted: false, canAskAgain: true });
		notifications.requestPermissionsAsync.mockResolvedValue({ granted: false });
		expect(await enableMealReminders(["09:00"])).toMatchObject({ ok: false, reason: "denied" });
		expect(notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
	});

	it("does not ask again when permission was permanently denied, and says where to change it", async () => {
		notifications.getPermissionsAsync.mockResolvedValue({ granted: false, canAskAgain: false });
		const result = await enableMealReminders(["09:00"]);
		expect(result).toMatchObject({ ok: false, reason: "denied", message: expect.stringContaining("device settings") });
		expect(notifications.requestPermissionsAsync).not.toHaveBeenCalled();
	});

	it("cleans up and reports an error when scheduling fails part-way", async () => {
		notifications.scheduleNotificationAsync.mockResolvedValueOnce("id").mockRejectedValueOnce(new Error("boom"));
		const result = await enableMealReminders(["09:00", "12:00", "18:00"]);
		expect(result).toMatchObject({ ok: false, reason: "error" });
		expect(notifications.cancelAllScheduledNotificationsAsync).toHaveBeenCalledTimes(2); // before scheduling, and cleanup
	});

	it("reports an error when permission status itself cannot be read", async () => {
		notifications.getPermissionsAsync.mockRejectedValue(new Error("no module"));
		expect(await enableMealReminders(["09:00"])).toMatchObject({ ok: false, reason: "error" });
	});

	it("schedules at most eight reminders", async () => {
		await enableMealReminders(Array.from({ length: 12 }, (_, i) => `${String(i).padStart(2, "0")}:00`));
		expect(notifications.scheduleNotificationAsync).toHaveBeenCalledTimes(8);
	});
});

describe("disabling reminders", () => {
	it("cancels everything that was scheduled and reports a failure to do so", async () => {
		expect(await disableMealReminders()).toEqual({ ok: true });
		expect(notifications.cancelAllScheduledNotificationsAsync).toHaveBeenCalledTimes(1);

		notifications.cancelAllScheduledNotificationsAsync.mockRejectedValueOnce(new Error("boom"));
		expect(await disableMealReminders()).toMatchObject({ ok: false, reason: "error" });
	});
});

describe("while device reminders are postponed", () => {
	it("never loads or calls the notifications package and explains why", async () => {
		features.reminderDelivery = false;
		expect(reminderSupport()).toMatchObject({ supported: false, reason: "postponed", message: expect.stringContaining("still being figured out") });

		expect(await enableMealReminders(["09:00"])).toMatchObject({ ok: false, reason: "unsupported" });
		expect(await disableMealReminders()).toEqual({ ok: true });
		for (const fn of Object.values(notifications)) if (typeof fn === "function" && "mock" in fn) expect(fn).not.toHaveBeenCalled();
	});
});
