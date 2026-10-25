/** Colour and motion of the heart-shaped streak indicator. */

const NO_STREAK = "#c9d3cb";

// A pleasant rainbow, one step per day of the streak: red, orange, yellow, green, blue, indigo, violet (then it stays violet).
const HUES = [0, 28, 48, 135, 210, 250, 285];

export function streakHue(days: number): number | null {
	if (!Number.isFinite(days) || days < 1) return null;
	return HUES[Math.min(Math.floor(days), HUES.length) - 1]!;
}

export function streakColor(days: number): string {
	const hue = streakHue(days);
	return hue === null ? NO_STREAK : `hsl(${hue}, 72%, 55%)`;
}

/** A heartbeat: a strong beat, a short rest, a softer beat, then rest. Values are scale factors at each step. */
export const HEARTBEAT: { scale: number; ms: number }[] = [
	{ scale: 1.24, ms: 130 },
	{ scale: 1.02, ms: 110 },
	{ scale: 1.16, ms: 130 },
	{ scale: 1, ms: 220 },
];
