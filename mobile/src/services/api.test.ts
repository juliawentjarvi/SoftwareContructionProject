import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const storage = vi.hoisted(() => ({ value: null as string | null }));

vi.mock("@react-native-async-storage/async-storage", () => ({
	default: {
		getItem: vi.fn(async () => storage.value),
		setItem: vi.fn(async (_key: string, value: string) => {
			storage.value = value;
		}),
	},
}));

vi.mock("react-native", () => ({ Platform: { OS: "web" } }));

let api: typeof import("./api");

beforeEach(async () => {
	storage.value = null;
	vi.resetModules();
	vi.stubGlobal("fetch", vi.fn());
	api = await import("./api");
});

afterEach(() => {
	vi.useRealTimers();
	vi.unstubAllGlobals();
});

describe("API endpoint selection", () => {
	it("normalizes server-root and /api URLs before checking and saving", async () => {
		vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 200 }));

		const result = await api.testAndSetApiBaseUrl("https://api.example.test/");

		expect(result).toEqual({ ok: true, baseUrl: "https://api.example.test/api" });
		expect(fetch).toHaveBeenCalledWith("https://api.example.test/health", expect.any(Object));
		expect(await api.getApiBaseUrl()).toBe("https://api.example.test/api");
	});

	it("keeps the saved endpoint when a candidate health check fails", async () => {
		vi.mocked(fetch)
			.mockResolvedValueOnce(new Response(null, { status: 200 }))
			.mockResolvedValueOnce(new Response(null, { status: 503 }));
		await api.testAndSetApiBaseUrl("https://working.example.test/api");

		const result = await api.testAndSetApiBaseUrl("https://unavailable.example.test");

		expect(result.ok).toBe(false);
		expect(await api.getApiBaseUrl()).toBe("https://working.example.test/api");
	});

	it("rejects malformed and unsafe server URLs without making a request", async () => {
		const invalid = await api.testAndSetApiBaseUrl("not a URL");
		const unsafe = await api.testAndSetApiBaseUrl("https://user:password@example.test");

		expect(invalid.ok).toBe(false);
		expect(unsafe.ok).toBe(false);
		expect(fetch).not.toHaveBeenCalled();
	});
});

describe("network failures", () => {
	it("reports a timeout and preserves it as a failed request", async () => {
		vi.useFakeTimers();
		const fetchMock = vi.fn((_input: RequestInfo | URL, init?: RequestInit) =>
			new Promise<Response>((_resolve, reject) => {
				init?.signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")), { once: true });
			}),
		);
		vi.stubGlobal("fetch", fetchMock);

		const pending = api.login("user@example.test", "password");
		await vi.advanceTimersByTimeAsync(0);
		expect(fetchMock).toHaveBeenCalledTimes(1);
		await vi.advanceTimersByTimeAsync(15000);
		const result = await pending;

		expect(result).toMatchObject({
			ok: false,
			status: 0,
			body: { message: "The request timed out. Check your connection and try again." },
		});
	});

	it("does not automatically retry a write after an interrupted request and recovers on a later read", async () => {
		const fetchMock = vi.mocked(fetch);
		fetchMock
			.mockRejectedValueOnce(new TypeError("Connection interrupted"))
			.mockResolvedValueOnce(new Response(JSON.stringify({ meals: [] }), { status: 200 }));

		const failedWrite = await api.createMeal("token", "Lunch", "lunch");
		expect(failedWrite.ok).toBe(false);
		expect(fetchMock).toHaveBeenCalledTimes(1);

		const recoveredRead = await api.getMeals("token");
		expect(recoveredRead).toMatchObject({ ok: true, body: { meals: [] } });
		expect(fetchMock).toHaveBeenCalledTimes(2);
	});

	it("does not report a malformed successful response as a successful request", async () => {
		vi.mocked(fetch).mockResolvedValue(new Response("not-json", { status: 200 }));

		const result = await api.login("user@example.test", "password");

		expect(result).toMatchObject({
			ok: false,
			status: 200,
			body: { message: "The server returned an invalid response. Try again later." },
		});
	});

	it("reports an interrupted response body as a failed request", async () => {
		const interrupted = new Response(null, { status: 200 });
		vi.spyOn(interrupted, "text").mockRejectedValue(new TypeError("Response stream interrupted"));
		vi.mocked(fetch).mockResolvedValue(interrupted);

		const result = await api.login("user@example.test", "password");

		expect(result).toMatchObject({
			ok: false,
			status: 200,
			body: { message: "The connection ended before the server response finished. Check your connection and try again." },
		});
	});
});

describe("failed writes are never reported as success", () => {
	const serverError = (status: number, code: string) => new Response(JSON.stringify({ error: { code, message: `${code} message` } }), { status });

	it("returns the server's error for a duplicate registration instead of a session", async () => {
		vi.mocked(fetch).mockResolvedValue(serverError(409, "ACCOUNT_EXISTS"));

		const result = await api.register("a@example.test", "a-long-password", "Bear");

		expect(result).toMatchObject({ ok: false, status: 409, body: { error: { code: "ACCOUNT_EXISTS" } } });
		expect(api.errorMessage(result.body as Parameters<typeof api.errorMessage>[0], "fallback")).toBe("ACCOUNT_EXISTS message");
	});

	it("returns a failure for rejected credentials and an unreachable server on login", async () => {
		vi.mocked(fetch).mockResolvedValueOnce(serverError(401, "INVALID_CREDENTIALS")).mockRejectedValueOnce(new TypeError("offline"));

		expect(await api.login("a@example.test", "wrong")).toMatchObject({ ok: false, status: 401 });
		expect(await api.login("a@example.test", "wrong")).toMatchObject({ ok: false, status: 0 });
	});

	it("returns a failure for a rejected or interrupted meal save, sends each write once, and uses the same body on a manual retry", async () => {
		vi.mocked(fetch).mockResolvedValueOnce(serverError(400, "INVALID_REQUEST")).mockRejectedValueOnce(new TypeError("offline"));

		const rejected = await api.createMeal("token", "Soup", "lunch", "notes", "2026-10-01T08:00:00+02:00");
		const interrupted = await api.createMeal("token", "Soup", "lunch", "notes", "2026-10-01T08:00:00+02:00");

		expect(rejected.ok).toBe(false);
		expect(interrupted.ok).toBe(false);
		expect(fetch).toHaveBeenCalledTimes(2);
		const bodies = vi.mocked(fetch).mock.calls.map(([, init]) => init?.body);
		expect(bodies[0]).toBe(bodies[1]);
		expect(JSON.parse(bodies[0] as string)).toMatchObject({ name: "Soup", notes: "notes", eatenAt: "2026-10-01T08:00:00+02:00" });
	});
});
