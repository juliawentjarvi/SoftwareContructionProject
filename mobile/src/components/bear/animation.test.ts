import { describe, expect, it } from "vitest";
import { BearAnimator, blink, coverEyes, earWave, feedJump, hearts, waveRightArm } from "./animation";

describe("BearAnimator", () => {
	it("returns to the resting pose when a clip finishes", () => {
		const animator = new BearAnimator();
		animator.breathing = false;
		animator.start(blink(), 0);
		expect(animator.sample(0.12).leftEye?.sy).toBeLessThan(0.2);
		expect(animator.sample(1)).toEqual({});
		expect(animator.isPlaying()).toBe(false);
	});

	it("replaces a running clip in the same channel", () => {
		const animator = new BearAnimator();
		animator.breathing = false;
		animator.start(waveRightArm(), 0);
		animator.start(coverEyes(), 0.2);
		const pose = animator.sample(1.0);
		expect(pose.rightArm?.r).toBeUndefined();
		expect(pose.rightArmF?.o).toBe(1);
	});

	it("runs clips from different channels together", () => {
		const animator = new BearAnimator();
		animator.breathing = false;
		animator.start(feedJump(), 0);
		animator.start(hearts(), 0);
		const pose = animator.sample(0.5);
		expect(pose.main?.y).toBeLessThan(0);
		expect(pose.heart_emotes?.o).toBe(1);
	});

	it("waves the chosen ear only", () => {
		const left = earWave("left").sample(0.2);
		expect(Object.keys(left)).toEqual(["leftEar"]);
		expect(Object.keys(earWave("right").sample(0.2))).toEqual(["rightEar"]);
	});

	it("does not breathe when breathing is off", () => {
		const animator = new BearAnimator();
		animator.breathing = false;
		expect(animator.sample(3)).toEqual({});
		animator.breathing = true;
		expect(animator.sample(3).main).toBeDefined();
	});
});
