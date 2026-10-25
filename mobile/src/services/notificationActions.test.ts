import { describe, expect, it, vi } from "vitest";
import { ActionDeps, DEFAULT_ACTION, handleNotificationResponse, intentFromResponse, mealTypeForHour, NotificationResponseLike } from "./notificationActions";

const response = (overrides: Partial<NotificationResponseLike> = {}): NotificationResponseLike => ({
	actionIdentifier: "log-meal",
	userText: "Soup",
	notification: { request: { identifier: "n1" } },
	...overrides,
});

describe("intentFromResponse", () => {
	it("opens the meal log when the notification itself is tapped", () => {
		expect(intentFromResponse(response({ actionIdentifier: DEFAULT_ACTION }))).toEqual({ kind: "open-meals" });
	});

	it("turns text typed into the action into a trimmed, bounded meal name", () => {
		expect(intentFromResponse(response({ userText: "  Soup  " }))).toMatchObject({ kind: "log-meal", name: "Soup" });
		const long = intentFromResponse(response({ userText: "x".repeat(300) }));
		expect(long.kind === "log-meal" && long.name.length).toBe(100);
	});

	it("opens the app instead when the action was submitted without text, and ignores unknown actions", () => {
		expect(intentFromResponse(response({ userText: "   " }))).toEqual({ kind: "open-meals" });
		expect(intentFromResponse(response({ userText: undefined }))).toEqual({ kind: "open-meals" });
		expect(intentFromResponse(response({ actionIdentifier: "something-else" }))).toEqual({ kind: "ignore" });
	});
});

describe("mealTypeForHour", () => {
	it("guesses a meal type from the local hour", () => {
		expect([7, 12, 19, 23, 3].map(mealTypeForHour)).toEqual(["breakfast", "lunch", "dinner", "snack", "snack"]);
	});
});

function deps(overrides: Partial<ActionDeps> = {}) {
	let handled: string | null = null;
	const base: ActionDeps = {
		loadToken: vi.fn(async () => "token"),
		createMeal: vi.fn(async () => ({ ok: true })),
		loadHandled: vi.fn(async () => handled),
		saveHandled: vi.fn(async (key: string) => { handled = key; }),
		now: () => new Date(2026, 9, 25, 12, 30),
	};
	return { ...base, ...overrides };
}

describe("handleNotificationResponse", () => {
	it("saves the typed meal once with the stored token and a meal type for the time of day", async () => {
		const d = deps();
		expect(await handleNotificationResponse(response(), d)).toEqual({ status: "logged", name: "Soup" });
		expect(d.createMeal).toHaveBeenCalledWith("token", "Soup", "lunch", expect.stringMatching(/^2026-10-25T/));
	});

	it("does not save the same response twice, even when it is delivered again", async () => {
		const d = deps();
		await handleNotificationResponse(response(), d);
		expect(await handleNotificationResponse(response(), d)).toEqual({ status: "duplicate" });
		expect(d.createMeal).toHaveBeenCalledTimes(1);
	});

	it("reports a failed save without retrying it, and still counts it as handled", async () => {
		const d = deps({ createMeal: vi.fn(async () => ({ ok: false })) });
		expect(await handleNotificationResponse(response(), d)).toEqual({ status: "failed", name: "Soup" });
		expect(await handleNotificationResponse(response(), d)).toEqual({ status: "duplicate" });
		expect(d.createMeal).toHaveBeenCalledTimes(1);
	});

	it("asks the person to sign in when no session is stored, and never calls the API", async () => {
		const d = deps({ loadToken: vi.fn(async () => null) });
		expect(await handleNotificationResponse(response(), d)).toEqual({ status: "needs-sign-in", name: "Soup" });
		expect(d.createMeal).not.toHaveBeenCalled();
	});

	it("opens the meal log for a tap and ignores other responses", async () => {
		const d = deps();
		expect(await handleNotificationResponse(response({ actionIdentifier: DEFAULT_ACTION }), d)).toEqual({ status: "open-meals" });
		expect(await handleNotificationResponse(response({ actionIdentifier: "dismiss" }), d)).toEqual({ status: "ignored" });
		expect(d.createMeal).not.toHaveBeenCalled();
	});
});
