import { describe, expect, it } from "vitest";
import { HEARTBEAT, streakColor, streakHue } from "./streakHeart";

describe("streak heart colour", () => {
	it("is grey without a streak and for nonsense input", () => {
		expect(streakColor(0)).toBe("#c9d3cb");
		expect(streakColor(-3)).toBe("#c9d3cb");
		expect(streakColor(Number.NaN)).toBe("#c9d3cb");
	});

	it("moves through the rainbow, one new colour for each of the first seven days", () => {
		const hues = [1, 2, 3, 4, 5, 6, 7].map((days) => streakHue(days)!);
		expect(new Set(hues).size).toBe(7);
		expect(hues[0]).toBe(0); // red first
		expect(hues[6]).toBe(285); // violet last
		expect(streakColor(1)).toBe("hsl(0, 72%, 55%)");
	});

	it("stays at the last colour for longer streaks", () => {
		expect(streakColor(8)).toBe(streakColor(7));
		expect(streakColor(400)).toBe(streakColor(7));
	});
});

describe("heartbeat", () => {
	it("beats twice and settles back to normal size", () => {
		expect(HEARTBEAT.filter((step) => step.scale > 1.1)).toHaveLength(2);
		expect(HEARTBEAT.at(-1)!.scale).toBe(1);
		expect(HEARTBEAT.reduce((sum, step) => sum + step.ms, 0)).toBeLessThan(1000);
	});
});
