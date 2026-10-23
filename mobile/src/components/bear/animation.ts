import type { PartPose, Pose } from "./pose";

/** A clip lasts `duration` seconds and returns the pose offsets it contributes at time `t`. Clips in the same channel replace each other. */
export type Clip = { name: string; channel: string; duration: number; sample: (t: number) => Pose };

export const TAU = Math.PI * 2;
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const smooth = (v: number) => { const k = clamp01(v); return k * k * (3 - 2 * k); };
/** 0 → 1 over `rise`, holds, then 1 → 0 over `fall` at the end of `duration`. */
export const envelope = (t: number, duration: number, rise: number, fall: number) => smooth(t / rise) * smooth((duration - t) / fall);
/** Single hump 0 → 1 → 0 across [0, 1]. */
const hump = (u: number) => Math.sin(Math.PI * clamp01(u));

const pair = <T,>(left: T, right: T, a: string, b: string) => ({ [a]: left, [b]: right }) as Record<string, T>;

function addPose(target: Pose, source: Pose) {
	for (const [name, p] of Object.entries(source)) {
		const t: PartPose = (target[name] ??= {});
		if (p.x) t.x = (t.x ?? 0) + p.x;
		if (p.y) t.y = (t.y ?? 0) + p.y;
		if (p.r) t.r = (t.r ?? 0) + p.r;
		if (p.sx !== undefined) t.sx = (t.sx ?? 1) * p.sx;
		if (p.sy !== undefined) t.sy = (t.sy ?? 1) * p.sy;
		if (p.o !== undefined) t.o = p.o;
	}
}

export class BearAnimator {
	private active = new Map<string, { clip: Clip; start: number }>();
	/** Continuous breathing, disabled for reduced motion. */
	breathing = true;

	start(clip: Clip, now: number) {
		this.active.set(clip.channel, { clip, start: now });
	}

	isPlaying(channel?: string) {
		return channel ? this.active.has(channel) : this.active.size > 0;
	}

	/** Combined pose at `now` (seconds). Finished clips are dropped. */
	sample(now: number): Pose {
		const pose: Pose = {};
		if (this.breathing) {
			const breath = Math.sin(now * 1.6);
			addPose(pose, { main: { sy: 1 + 0.008 * breath, sx: 1 - 0.004 * breath } });
		}
		for (const [channel, { clip, start }] of this.active) {
			const t = now - start;
			if (t >= clip.duration) { this.active.delete(channel); continue; }
			addPose(pose, clip.sample(Math.max(0, t)));
		}
		return pose;
	}
}

// ---------------------------------------------------------------- clips
const RIGHT_ARM_WAVE = -72;

function waveArm(t: number, duration: number): Pose {
	const k = envelope(t, duration, 0.3, 0.35);
	return { rightArm: { r: k * (RIGHT_ARM_WAVE + 14 * Math.sin(TAU * 3.4 * t)) } };
}

export const blink = (): Clip => ({
	name: "blink", channel: "blink", duration: 0.24,
	sample: (t) => {
		const squash = 1 - 0.92 * hump(t / 0.24);
		return pair({ sy: squash }, { sy: squash }, "leftEye", "rightEye");
	},
});

export const earWave = (side: "left" | "right"): Clip => ({
	name: `${side}EarWave`, channel: "ear", duration: 1.2,
	sample: (t) => ({ [`${side}Ear`]: { r: (side === "left" ? 1 : -1) * 16 * hump(t / 1.2) * Math.sin(TAU * 3.2 * t) } }),
});

export const waveRightArm = (): Clip => ({
	name: "wave", channel: "body", duration: 2.0,
	sample: (t) => ({ ...waveArm(t, 2.0), headAll: { r: 2.5 * envelope(t, 2.0, 0.3, 0.4) * Math.sin(TAU * 1.7 * t) } }),
});

export const surprisedBrows = (): Clip => ({
	name: "surprised", channel: "body", duration: 1.5,
	sample: (t) => {
		const k = envelope(t, 1.5, 0.15, 0.4);
		return {
			eyebrows: { y: -48 * k },
			...pair({ sx: 1 + 0.14 * k, sy: 1 + 0.14 * k }, { sx: 1 + 0.14 * k, sy: 1 + 0.14 * k }, "leftEye", "rightEye"),
			main: { y: -14 * hump(t / 0.35) },
		};
	},
});

/** Arms swing up in front of the eyes (using the front copies of the arms) and hold there. */
export const coverEyes = (): Clip => ({
	name: "coverEyes", channel: "body", duration: 2.2,
	sample: (t) => {
		const k = envelope(t, 2.2, 0.5, 0.45);
		const peek = 1 + 0.03 * Math.sin(TAU * 2.2 * t);
		return {
			rightArm: { o: 0 }, leftArm: { o: 0 },
			rightArmF: { o: 1, r: -100 * k * peek },
			leftArmF: { o: 1, r: 94 * k * peek },
			headAll: { r: -2 * k },
		};
	},
});

/** Both arms wave while the bear bends its knees a few times, as if bored. */
export const boredWave = (): Clip => ({
	name: "boredWave", channel: "body", duration: 3.8,
	sample: (t) => {
		const k = envelope(t, 3.8, 0.4, 0.4);
		const bend = k * Math.max(0, Math.sin(TAU * 3 * t / 3.8 - Math.PI / 2) * 0.5 + 0.5);
		const wave = 12 * Math.sin(TAU * 2.4 * t);
		return {
			rightArm: { r: k * (-48 + wave) },
			leftArm: { r: k * (48 - wave) },
			main: { y: 34 * bend },
			legs: { y: -34 * bend, sx: 1 + 0.07 * bend },
			headAll: { r: 2 * k * Math.sin(TAU * 1.2 * t) },
		};
	},
});

/** Small waving arm motions at the sides while the legs scuff, like kicking sand. */
export const kickSand = (): Clip => ({
	name: "kickSand", channel: "body", duration: 3.6,
	sample: (t) => {
		const k = envelope(t, 3.6, 0.4, 0.4);
		const phase = TAU * 1.5 * t;
		const kick = Math.max(0, Math.sin(phase));
		const kickOther = Math.max(0, Math.sin(phase + Math.PI));
		return {
			rightArm: { r: k * (-8 + 9 * Math.sin(phase)) },
			leftArm: { r: k * (8 + 9 * Math.sin(phase + Math.PI)) },
			rightLeg: { r: k * -22 * kick },
			leftLeg: { r: k * 22 * kickOther },
			main: { r: k * 1.5 * Math.sin(phase), y: k * -4 * Math.max(kick, kickOther) },
			headAll: { r: k * 2.5 * Math.sin(phase + 0.6) },
		};
	},
});

/** Jump (with a little squash and stretch) while waving. */
export const feedJump = (): Clip => ({
	name: "feedJump", channel: "body", duration: 2.0,
	sample: (t) => {
		const squash = t < 0.18 ? hump(t / 0.36) : 0;
		const air = t >= 0.18 && t < 0.88 ? hump((t - 0.18) / 0.7) : 0;
		const land = t >= 0.88 && t < 1.04 ? hump((t - 0.88) / 0.32) : 0;
		const second = t >= 1.1 && t < 1.55 ? hump((t - 1.1) / 0.45) : 0;
		return {
			main: {
				y: -150 * air - 60 * second,
				sy: 1 - 0.1 * squash - 0.08 * land + 0.06 * air,
				sx: 1 + 0.06 * squash + 0.05 * land - 0.03 * air,
			},
			...waveArm(t, 2.0),
			leftArm: { r: envelope(t, 2.0, 0.3, 0.35) * (20 + 8 * Math.sin(TAU * 3 * t + 1)) },
		};
	},
});

/** Hearts pop up near the bear, float up and disappear; two rounds. */
export const hearts = (): Clip => ({
	name: "hearts", channel: "hearts", duration: 3.8,
	sample: (t) => {
		const one = (delay: number, rise: number) => {
			const u = clamp01((t - delay) / 1.2);
			if (u <= 0 || u >= 1) return { o: 0 };
			const pop = smooth(u / 0.25);
			const fade = smooth((1 - u) / 0.35);
			return { o: Math.max(0.01, fade), sx: Math.max(0.01, pop), sy: Math.max(0.01, pop), y: -50 - rise * u, x: 30, r: 8 * Math.sin(TAU * u) };
		};
		return {
			heart_emotes: { o: 1 },
			bigHeart: one(0.6, 70),
			littleHeart: one(0.85, 90),
			...(t > 2.1 ? { bigHeart: one(2.1, 80), littleHeart: one(2.3, 70) } : {}),
		};
	},
});

/** Reactions to a tap: arm wave, surprised eyebrows, or arms in front of the eyes. */
export const TAP_REACTIONS = [waveRightArm, surprisedBrows, coverEyes];
export const BORED_BEHAVIORS = [boredWave, kickSand];
