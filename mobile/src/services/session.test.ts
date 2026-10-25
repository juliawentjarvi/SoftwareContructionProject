import { describe, expect, it, vi } from "vitest";

vi.mock("react-native", () => ({ Platform: { OS: "ios" } }));

import { endSession } from "./session";

describe("endSession (log out)", () => {
	it("removes the stored sign-in and cancels device reminders", async () => {
		const deps = { clearToken: vi.fn(async () => undefined), cancelReminders: vi.fn(async () => ({ ok: true as const })) };
		await endSession(deps);
		expect(deps.clearToken).toHaveBeenCalledTimes(1);
		expect(deps.cancelReminders).toHaveBeenCalledTimes(1);
	});

	it("never throws, even when clean-up fails, and can be called twice", async () => {
		const deps = { clearToken: vi.fn(async () => { throw new Error("storage"); }), cancelReminders: vi.fn(async () => { throw new Error("native"); }) };
		await expect(endSession(deps)).resolves.toBeUndefined();
		await expect(endSession(deps)).resolves.toBeUndefined();
	});
});
