import { describe, expect, it } from "vitest";
import { goalBarFill, goalBarLabel } from "./goalBar";

describe("goal bar", () => {
	it("fills in proportion to meals logged out of the target", () => {
		expect(goalBarFill(0, 3)).toBe(0);
		expect(goalBarFill(1, 3)).toBeCloseTo(33.333, 2);
		expect(goalBarFill(3, 3)).toBe(100);
		expect(goalBarFill(1, 1)).toBe(100);
		expect(goalBarFill(4, 12)).toBeCloseTo(33.333, 2);
	});

	it("stays between empty and full, even with more meals than the target or a bad target", () => {
		expect(goalBarFill(5, 3)).toBe(100);
		expect(goalBarFill(-1, 3)).toBe(0);
		expect(goalBarFill(2, 0)).toBe(0);
		expect(goalBarFill(Number.NaN, 3)).toBe(0);
	});

	it("labels the count as k/target", () => {
		expect(goalBarLabel(2, 3)).toBe("2/3");
		expect(goalBarLabel(0, 12)).toBe("0/12");
		expect(goalBarLabel(5, 3)).toBe("5/3");
	});
});
