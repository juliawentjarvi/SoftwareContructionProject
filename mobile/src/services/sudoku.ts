/** Sudoku rules and puzzle generation. A board is 81 numbers, row by row; 0 means empty. */

export type Board = number[];

const rowOf = (i: number) => Math.floor(i / 9);
const colOf = (i: number) => i % 9;
const boxOf = (i: number) => Math.floor(rowOf(i) / 3) * 3 + Math.floor(colOf(i) / 3);

// Small seeded generator so a puzzle can be repeated in tests.
function random(seed: number) {
	let a = seed >>> 0;
	return () => {
		a = (a + 0x6d2b79f5) >>> 0;
		let t = a;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

function shuffled<T>(items: T[], rand: () => number): T[] {
	const copy = [...items];
	for (let i = copy.length - 1; i > 0; i--) {
		const j = Math.floor(rand() * (i + 1));
		[copy[i], copy[j]] = [copy[j]!, copy[i]!];
	}
	return copy;
}

function candidates(board: Board, index: number): number[] {
	const used = new Set<number>();
	for (let i = 0; i < 81; i++) {
		if (board[i] && (rowOf(i) === rowOf(index) || colOf(i) === colOf(index) || boxOf(i) === boxOf(index))) used.add(board[i]!);
	}
	return [1, 2, 3, 4, 5, 6, 7, 8, 9].filter((d) => !used.has(d));
}

/** Counts solutions, stopping at `limit` (2 is enough to know whether a puzzle is unique). */
export function countSolutions(board: Board, limit = 2): number {
	const work = [...board];
	let count = 0;
	const search = () => {
		if (count >= limit) return;
		// Pick the empty cell with the fewest candidates.
		let best = -1;
		let bestOptions: number[] = [];
		for (let i = 0; i < 81; i++) {
			if (work[i] !== 0) continue;
			const options = candidates(work, i);
			if (best === -1 || options.length < bestOptions.length) {
				best = i;
				bestOptions = options;
				if (options.length === 0) return;
			}
		}
		if (best === -1) { count++; return; }
		for (const digit of bestOptions) {
			work[best] = digit;
			search();
			work[best] = 0;
			if (count >= limit) return;
		}
	};
	search();
	return count;
}

function fullSolution(rand: () => number): Board {
	const board: Board = Array(81).fill(0);
	const fill = (index: number): boolean => {
		if (index === 81) return true;
		for (const digit of shuffled(candidates(board, index), rand)) {
			board[index] = digit;
			if (fill(index + 1)) return true;
		}
		board[index] = 0;
		return false;
	};
	fill(0);
	return board;
}

/** A puzzle with exactly one solution, plus that solution. `clues` is how many cells are given (about 36 is medium). */
export function generatePuzzle(seed: number = Math.floor(Math.random() * 2 ** 31), clues = 36): { puzzle: Board; solution: Board } {
	const rand = random(seed);
	const solution = fullSolution(rand);
	const puzzle = [...solution];
	for (const index of shuffled(Array.from({ length: 81 }, (_, i) => i), rand)) {
		if (puzzle.filter((v) => v !== 0).length <= clues) break;
		const keep = puzzle[index]!;
		puzzle[index] = 0;
		if (countSolutions(puzzle, 2) !== 1) puzzle[index] = keep; // removing it would allow more than one solution
	}
	return { puzzle, solution };
}

/** True for every cell whose digit also appears elsewhere in its row, column or 3x3 box. */
export function conflictCells(board: Board): boolean[] {
	const red = Array<boolean>(81).fill(false);
	for (let a = 0; a < 81; a++) {
		if (!board[a]) continue;
		for (let b = a + 1; b < 81; b++) {
			if (board[a] !== board[b]) continue;
			if (rowOf(a) === rowOf(b) || colOf(a) === colOf(b) || boxOf(a) === boxOf(b)) { red[a] = true; red[b] = true; }
		}
	}
	return red;
}

/** Index 1-9: true when that digit is already in all nine 3x3 boxes, so its button is muted. */
export function disabledDigits(board: Board): boolean[] {
	const result = Array<boolean>(10).fill(false);
	for (let digit = 1; digit <= 9; digit++) {
		const boxes = new Set<number>();
		board.forEach((value, i) => { if (value === digit) boxes.add(boxOf(i)); });
		result[digit] = boxes.size === 9;
	}
	return result;
}

export function isValidSolution(board: Board): boolean {
	if (board.some((v) => v < 1 || v > 9)) return false;
	return !conflictCells(board).some(Boolean);
}

export type BoardStatus = { status: "in-progress" | "win" | "incorrect"; conflicts: boolean[] };

/** Checks the board when the player fills the last cell: a win, or an incorrect result that lets them keep correcting. */
export function boardStatus(board: Board): BoardStatus {
	const conflicts = conflictCells(board);
	if (board.some((v) => v === 0)) return { status: "in-progress", conflicts };
	return { status: isValidSolution(board) ? "win" : "incorrect", conflicts };
}

/** A copy of the board with `digit` (0 erases) placed, unless the cell is a given clue. */
export function placeDigit(board: Board, index: number, digit: number, locked: Set<number>): Board {
	if (locked.has(index)) return board;
	const next = [...board];
	next[index] = digit;
	return next;
}
