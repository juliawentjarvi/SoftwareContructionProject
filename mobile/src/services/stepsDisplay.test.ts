import { describe, expect, it } from "vitest";
import { energyLabel, stepsLabel } from "./stepsDisplay";

describe("stepsLabel", () => {
	it("says so when no steps were entered, instead of showing zero or a met target", () => {
		expect(stepsLabel(null, 8000)).toBe("No steps entered today");
		expect(stepsLabel(null, null)).toBe("No steps entered today");
	});

	it("shows zero as a real entry", () => {
		expect(stepsLabel(0, 8000)).toBe("0 / 8,000 steps");
	});

	it("shows progress against the target, and marks it reached", () => {
		expect(stepsLabel(4200, 8000)).toBe("4,200 / 8,000 steps");
		expect(stepsLabel(8000, 8000)).toBe("8,000 / 8,000 steps - target reached");
		expect(stepsLabel(9100, 8000)).toBe("9,100 / 8,000 steps - target reached");
	});

	it("never claims a target was reached when none is set", () => {
		expect(stepsLabel(12000, null)).toBe("12,000 steps (no step target set)");
	});
});

describe("energyLabel", () => {
	it("shows points out of the full bar, including a negative balance", () => {
		expect(energyLabel({ points: 30, target: 50, fill: 60 })).toBe("30/50 energy");
		expect(energyLabel({ points: -10, target: 50, fill: 0 })).toBe("-10/50 energy");
		expect(energyLabel({ points: 80, target: 50, fill: 100 })).toBe("80/50 energy");
	});
});
