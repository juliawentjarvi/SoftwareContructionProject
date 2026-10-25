import { describe, expect, it, vi } from "vitest";

vi.mock("react-native", () => ({ Platform: { OS: "ios" } }));
vi.mock("expo-constants", () => ({ default: { expoConfig: null } }));
vi.mock("@react-native-async-storage/async-storage", () => ({ default: { getItem: vi.fn(), setItem: vi.fn(), removeItem: vi.fn() } }));

import type { AuthSession } from "./api";
import { restoreSession } from "./restoreSession";

const session: AuthSession = {
	accessToken: "fresh",
	user: { id: "1", email: "a@example.test", displayName: "A", timezone: "UTC", dailyMealGoal: 3, stepTarget: null, selectedTheme: "meadow", selectedAccessory: null, hasProfilePicture: false, notificationsEnabled: false, reminderTimes: ["08:00", "12:30", "18:30"] },
};

function deps(overrides: Record<string, unknown> = {}) {
	return {
		loadToken: vi.fn(async () => "stored"),
		saveToken: vi.fn(async () => undefined),
		clearToken: vi.fn(async () => undefined),
		refresh: vi.fn(async () => ({ ok: true as const, status: 200, body: session })),
		...overrides,
	} as never as Parameters<typeof restoreSession>[0] & { saveToken: ReturnType<typeof vi.fn>; clearToken: ReturnType<typeof vi.fn> };
}

describe("restoreSession", () => {
	it("stays signed out when nothing is stored, without calling the server", async () => {
		const d = deps({ loadToken: vi.fn(async () => null) });
		expect(await restoreSession(d)).toEqual({ status: "signed-out" });
		expect(d.refresh).not.toHaveBeenCalled();
	});

	it("signs back in with the stored token and keeps the fresh token it receives", async () => {
		const d = deps();
		expect(await restoreSession(d)).toEqual({ status: "signed-in", session });
		expect(d.refresh).toHaveBeenCalledWith("stored");
		expect(d.saveToken).toHaveBeenCalledWith("fresh");
	});

	it("forgets a token the server rejects (expired, or the account was deleted)", async () => {
		const d = deps({ refresh: vi.fn(async () => ({ ok: false as const, status: 401, body: {} })) });
		expect(await restoreSession(d)).toEqual({ status: "signed-out" });
		expect(d.clearToken).toHaveBeenCalled();
	});

	it("keeps the token and reports the server as unreachable when it cannot be reached or fails", async () => {
		for (const status of [0, 500, 503]) {
			const d = deps({ refresh: vi.fn(async () => ({ ok: false as const, status, body: { message: "offline" } })) });
			const result = await restoreSession(d);
			expect(result.status).toBe("unreachable");
			expect(d.clearToken).not.toHaveBeenCalled();
		}
	});
});
