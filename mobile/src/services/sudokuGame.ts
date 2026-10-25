import AsyncStorage from "@react-native-async-storage/async-storage";
import api, { errorMessage } from "./api";
import { Board, generatePuzzle } from "./sudoku";

const KEY = "bear-care-sudoku-game";

export interface SavedGame {
	gameId: string;
	puzzle: Board;
	solution: Board;
	board: Board;
	/** True once the server accepted the start (and charged the 5 energy). A pending game is retried with the same id. */
	started: boolean;
}

export interface SudokuDeps {
	load: () => Promise<SavedGame | null>;
	save: (game: SavedGame) => Promise<void>;
	clear: () => Promise<void>;
	start: (token: string, gameId: string) => Promise<{ ok: true; status: number } | { ok: false; status: number; message: string }>;
	complete: (token: string, gameId: string) => Promise<{ ok: true; status: number; points: number; awarded: number } | { ok: false; status: number; message: string }>;
	generate: () => { puzzle: Board; solution: Board };
	newId: () => string;
}

function uuid4(): string {
	return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
		const r = Math.floor(Math.random() * 16);
		return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
	});
}

export const realSudokuDeps: SudokuDeps = {
	load: async () => {
		try {
			const text = await AsyncStorage.getItem(KEY);
			return text ? (JSON.parse(text) as SavedGame) : null;
		} catch { return null; }
	},
	save: async (game) => { try { await AsyncStorage.setItem(KEY, JSON.stringify(game)); } catch { /* the game continues in memory */ } },
	clear: async () => { try { await AsyncStorage.removeItem(KEY); } catch { /* nothing stored */ } },
	start: async (token, gameId) => {
		const result = await api.startSudokuGame(token, gameId);
		return result.ok ? { ok: true, status: result.status } : { ok: false, status: result.status, message: errorMessage(result.body, "The game couldn't be started. Check your connection and try again.") };
	},
	complete: async (token, gameId) => {
		const result = await api.completeSudokuGame(token, gameId);
		return result.ok
			? { ok: true, status: result.status, points: result.body.points, awarded: result.body.rewardPointsAwarded }
			: { ok: false, status: result.status, message: errorMessage(result.body, "The result couldn't be saved yet. Try again when you're connected.") };
	},
	generate: () => generatePuzzle(),
	newId: uuid4,
};

export type StartResult = { ok: true; game: SavedGame; resumed: boolean } | { ok: false; message: string };

/**
 * Resume the saved game, or start a new one. Starting costs 5 energy once, charged by the server when it first sees the
 * game id. If the request fails the game is kept (not yet started) and the retry reuses the same id, so an uncertain
 * request can never be charged twice; resuming never contacts the server for a charge at all.
 */
export async function startOrResumeGame(token: string, deps: SudokuDeps = realSudokuDeps): Promise<StartResult> {
	let game = await deps.load();
	if (game?.started) return { ok: true, game, resumed: true };

	if (!game) {
		const { puzzle, solution } = deps.generate();
		game = { gameId: deps.newId(), puzzle, solution, board: [...puzzle], started: false };
		await deps.save(game);
	}
	const result = await deps.start(token, game.gameId);
	if (!result.ok) return { ok: false, message: result.message };
	game = { ...game, started: true };
	await deps.save(game);
	return { ok: true, game, resumed: false };
}

export type CompleteResult = { ok: true; awarded: number; points: number } | { ok: false; message: string };

/** Tell the server the game is solved (it awards the reward points once). The saved game is kept until that succeeds. */
export async function completeGame(token: string, deps: SudokuDeps = realSudokuDeps): Promise<CompleteResult> {
	const game = await deps.load();
	if (!game?.started) return { ok: false, message: "There is no game to finish." };
	const result = await deps.complete(token, game.gameId);
	if (!result.ok) return { ok: false, message: result.message };
	await deps.clear();
	return { ok: true, awarded: result.awarded, points: result.points };
}
