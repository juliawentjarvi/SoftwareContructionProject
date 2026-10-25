import { describe, expect, it } from "vitest";
import { idlePolicy } from "./idlePolicy";

describe("idlePolicy", () => {
	it("runs every idle animation when animate is on, whatever the device's reduce-motion setting", () => {
		expect(idlePolicy(true)).toEqual({ breathing: true, blinking: true, earWaves: true, bored: true });
	});

	it("runs none of them when animate is off; taps and feeding are not part of the idle policy", () => {
		expect(idlePolicy(false)).toEqual({ breathing: false, blinking: false, earWaves: false, bored: false });
	});
});
