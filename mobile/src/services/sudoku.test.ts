import { describe, expect, it } from "vitest";
import { boardStatus, conflictCells, countSolutions, disabledDigits, generatePuzzle, isValidSolution, placeDigit } from "./sudoku";

const SOLVED = [
	5, 3, 4, 6, 7, 8, 9, 1, 2,
	6, 7, 2, 1, 9, 5, 3, 4, 8,
	1, 9, 8, 3, 4, 2, 5, 6, 7,
	8, 5, 9, 7, 6, 1, 4, 2, 3,
	4, 2, 6, 8, 5, 3, 7, 9, 1,
	7, 1, 3, 9, 2, 4, 8, 5, 6,
	9, 6, 1, 5, 3, 7, 2, 8, 4,
	2, 8, 7, 4, 1, 9, 6, 3, 5,
	3, 4, 5, 2, 8, 6, 1, 7, 9,
];

describe("puzzle generation", () => {
	it("makes a valid puzzle with exactly one solution and the given clues kept in the solution", () => {
		const { puzzle, solution } = generatePuzzle(42);
		expect(puzzle).toHaveLength(81);
		expect(isValidSolution(solution)).toBe(true);
		expect(countSolutions(puzzle, 2)).toBe(1);
		expect(puzzle.filter((v) => v === 0).length).toBeGreaterThan(30);
		puzzle.forEach((value, i) => { if (value !== 0) expect(solution[i]).toBe(value); });
	});

	it("is repeatable for the same seed and different for another seed", () => {
		expect(generatePuzzle(7).puzzle).toEqual(generatePuzzle(7).puzzle);
		expect(generatePuzzle(7).puzzle).not.toEqual(generatePuzzle(8).puzzle);
	});
});

describe("number buttons (one digit per 3x3 box)", () => {
	it("mutes a digit only once it is in all nine boxes", () => {
		const board = Array(81).fill(0);
		const boxes = [0, 3, 6, 27, 30, 33, 54, 57, 60];
		boxes.slice(0, 8).forEach((cell) => { board[cell] = 5; });
		expect(disabledDigits(board)[5]).toBe(false); // in eight boxes: still usable
		board[boxes[8]!] = 5;
		expect(disabledDigits(board)[5]).toBe(true);
		expect(disabledDigits(board)[4]).toBe(false);
	});

	it("does not mute anything on an empty board and mutes every digit on a solved one", () => {
		expect(disabledDigits(Array(81).fill(0)).slice(1).every((d) => !d)).toBe(true);
		expect(disabledDigits(SOLVED).slice(1).every((d) => d)).toBe(true);
	});
});

describe("conflicts (shown in red)", () => {
	it("marks duplicates in a row, a column and a box", () => {
		const board = Array(81).fill(0);
		board[0] = 4; board[8] = 4; // same row
		board[18] = 7; board[72] = 7; // same column
		board[30] = 2; board[40] = 2; // same box? 30 is box 4 (row3,col3), 40 row4,col4 -> same box
		const red = conflictCells(board);
		expect([0, 8, 18, 72, 30, 40].every((i) => red[i])).toBe(true);
		expect(red.filter(Boolean)).toHaveLength(6);
	});

	it("marks nothing for a valid solution", () => {
		expect(conflictCells(SOLVED).some(Boolean)).toBe(false);
	});
});

describe("finishing a board", () => {
	it("reports in progress while any cell is empty", () => {
		const board = [...SOLVED]; board[10] = 0;
		expect(boardStatus(board)).toEqual({ status: "in-progress", conflicts: expect.any(Array) });
	});

	it("reports a win for a completely filled, correct board", () => {
		expect(boardStatus(SOLVED).status).toBe("win");
	});

	it("reports an incorrect result for a filled board with a clash, and lets play continue by changing a cell", () => {
		const wrong = [...SOLVED]; wrong[0] = 3; // clashes with the 3 in the same row and box
		const result = boardStatus(wrong);
		expect(result.status).toBe("incorrect");
		expect(result.conflicts[0]).toBe(true);
		const fixed = placeDigit(wrong, 0, 5, new Set());
		expect(boardStatus(fixed).status).toBe("win");
	});
});

describe("placeDigit", () => {
	it("never changes a given clue, and erases with 0", () => {
		const board = Array(81).fill(0); board[0] = 5;
		const locked = new Set([0]);
		expect(placeDigit(board, 0, 9, locked)[0]).toBe(5);
		expect(placeDigit(board, 1, 9, locked)[1]).toBe(9);
		expect(placeDigit(placeDigit(board, 1, 9, locked), 1, 0, locked)[1]).toBe(0);
	});

	it("does not mutate the board it is given", () => {
		const board = Array(81).fill(0);
		placeDigit(board, 3, 4, new Set());
		expect(board[3]).toBe(0);
	});
});
