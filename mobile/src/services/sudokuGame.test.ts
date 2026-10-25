import { describe, expect, it, vi } from "vitest";

vi.mock("react-native", () => ({ Platform: { OS: "ios" } }));
vi.mock("expo-constants", () => ({ default: { expoConfig: null } }));
vi.mock("@react-native-async-storage/async-storage", () => ({ default: { getItem: vi.fn(), setItem: vi.fn(), removeItem: vi.fn() } }));

import { SavedGame, SudokuDeps, completeGame, startOrResumeGame } from "./sudokuGame";

function deps(overrides: Partial<SudokuDeps> = {}) {
	let saved: SavedGame | null = null;
	const base: SudokuDeps = {
		load: vi.fn(async () => saved),
		save: vi.fn(async (game: SavedGame) => { saved = game; }),
		clear: vi.fn(async () => { saved = null; }),
		start: vi.fn(async () => ({ ok: true as const, status: 201 })),
		complete: vi.fn(async () => ({ ok: true as const, status: 200, points: 10, awarded: 10 })),
		generate: vi.fn(() => ({ puzzle: [1, 0], solution: [1, 2] })),
		newId: vi.fn(() => "00000000-0000-4000-8000-000000000001"),
	};
	return { ...base, ...overrides };
}

describe("startOrResumeGame", () => {
	it("starts a new game once (the server charges the energy) and saves it", async () => {
		const d = deps();
		const result = await startOrResumeGame("t", d);
		expect(result).toMatchObject({ ok: true, resumed: false });
		expect(d.start).toHaveBeenCalledTimes(1);
		expect(d.save).toHaveBeenCalled();
	});

	it("resumes a saved game without contacting the server, so it is never charged again", async () => {
		const d = deps();
		await startOrResumeGame("t", d);
		const again = await startOrResumeGame("t", d);
		expect(again).toMatchObject({ ok: true, resumed: true });
		expect(d.start).toHaveBeenCalledTimes(1);
	});

	it("reports a failed start and keeps the same game id for the retry, so an uncertain charge cannot double", async () => {
		const start = vi.fn()
			.mockResolvedValueOnce({ ok: false as const, status: 0, message: "offline" })
			.mockResolvedValueOnce({ ok: true as const, status: 200 });
		const newId = vi.fn().mockReturnValueOnce("00000000-0000-4000-8000-0000000000aa").mockReturnValueOnce("00000000-0000-4000-8000-0000000000bb");
		const d = deps({ start, newId });

		const failed = await startOrResumeGame("t", d);
		expect(failed).toMatchObject({ ok: false });
		const retried = await startOrResumeGame("t", d);
		expect(retried).toMatchObject({ ok: true });

		expect(start.mock.calls[0]![1]).toBe(start.mock.calls[1]![1]); // same game id both times
		expect(newId).toHaveBeenCalledTimes(1);
	});
});

describe("completeGame", () => {
	it("tells the server once, clears the saved game and reports the reward", async () => {
		const d = deps();
		await startOrResumeGame("t", d);
		const result = await completeGame("t", d);
		expect(result).toEqual({ ok: true, awarded: 10, points: 10 });
		expect(d.clear).toHaveBeenCalled();
	});

	it("keeps the finished game so completion can be retried when the server cannot be reached", async () => {
		const complete = vi.fn()
			.mockResolvedValueOnce({ ok: false as const, status: 0, message: "offline" })
			.mockResolvedValueOnce({ ok: true as const, status: 200, points: 10, awarded: 10 });
		const d = deps({ complete });
		await startOrResumeGame("t", d);

		expect(await completeGame("t", d)).toMatchObject({ ok: false });
		expect(d.clear).not.toHaveBeenCalled();
		expect(await completeGame("t", d)).toMatchObject({ ok: true });
		expect(d.clear).toHaveBeenCalledTimes(1);
	});

	it("does nothing when there is no saved game", async () => {
		const d = deps();
		expect(await completeGame("t", d)).toMatchObject({ ok: false });
		expect(d.complete).not.toHaveBeenCalled();
	});
});
