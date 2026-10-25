import { describe, expect, it, vi } from "vitest";

vi.mock("react-native", () => ({ Platform: { OS: "web" } }));

import { conflictFrom, versionsFor } from "./conflicts";

describe("conflictFrom", () => {
	it("recognises a changed-elsewhere response and keeps the latest values", () => {
		const user = { id: "1", displayName: "Latest" };
		const info = conflictFrom(409, { error: { code: "CONFLICT", message: "x", details: { fields: { displayName: { version: 2, value: "Latest" } }, user } } } as never);
		expect(info?.message).toMatch(/changed somewhere else/);
		expect(info?.fields.displayName).toEqual({ version: 2, value: "Latest" });
		expect(info?.user).toBe(user);
	});

	it("ignores other errors, including other 409s", () => {
		expect(conflictFrom(409, { error: { code: "NOT_UNLOCKED", message: "x" } } as never)).toBeNull();
		expect(conflictFrom(400, { error: { code: "CONFLICT", message: "x" } } as never)).toBeNull();
		expect(conflictFrom(0, { message: "offline" })).toBeNull();
	});
});

describe("versionsFor", () => {
	it("sends the stored version of each changed field, and 0 for a field never changed", () => {
		expect(versionsFor({ displayName: 3, stepTarget: 1 }, ["displayName", "dailyMealGoal"])).toEqual({ displayName: 3, dailyMealGoal: 0 });
		expect(versionsFor(undefined, ["displayName"])).toEqual({ displayName: 0 });
	});
});
