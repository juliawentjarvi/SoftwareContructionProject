import { PART_META } from "./bearMeta.generated";

/** Offsets for one bear part. x/y are in artwork (viewBox) units, r in degrees, sx/sy are scale factors, o is opacity. */
export type PartPose = { x?: number; y?: number; r?: number; sx?: number; sy?: number; o?: number };
export type Pose = Record<string, PartPose>;

/** Where each part rotates/scales around, as fractions of its bounding box (0,0 = top-left). Default is the centre. */
export const PIVOTS: Record<string, [number, number]> = {
	leftEar: [0.8, 0.8],
	rightEar: [0.2, 0.8],
	rightArm: [0.08, 0.1],
	leftArm: [0.92, 0.1],
	rightArmF: [0.08, 0.1],
	leftArmF: [0.92, 0.1],
	rightLeg: [0.5, 0.0],
	leftLeg: [0.5, 0.0],
	main: [0.5, 1.0],
	legs: [0.5, 1.0],
	headAll: [0.5, 1.0],
};

/** Parts that are invisible unless an animation shows them. */
export const HIDDEN_PARTS = new Set(["rightArmF", "leftArmF", "heart_emotes"]);

const fmt = (n: number) => Math.round(n * 10000) / 10000;

/** SVG matrix() transform for a part pose, or undefined when it is the identity. */
export function partTransform(name: string, pose: PartPose | undefined): string | undefined {
	const meta = PART_META[name];
	if (!pose || !meta) return undefined;
	const { x = 0, y = 0, r = 0, sx = 1, sy = 1 } = pose;
	if (!x && !y && !r && sx === 1 && sy === 1) return undefined;
	const [fx, fy] = PIVOTS[name] ?? [0.5, 0.5];
	const px = meta.box[0] + (meta.box[2] - meta.box[0]) * fx;
	const py = meta.box[1] + (meta.box[3] - meta.box[1]) * fy;
	const rad = (r * Math.PI) / 180;
	const cos = Math.cos(rad);
	const sin = Math.sin(rad);
	// translate(x/scale, y/scale) · translate(pivot) · rotate · scale · translate(-pivot)
	const a = cos * sx;
	const b = sin * sx;
	const c = -sin * sy;
	const d = cos * sy;
	const e = px - (a * px + c * py) + x / meta.scale;
	const f = py - (b * px + d * py) + y / meta.scale;
	return `matrix(${[a, b, c, d, e, f].map(fmt).join(" ")})`;
}

/** Opacity for a part: an explicit pose value wins, otherwise hidden parts are 0 and everything else 1. */
export function partOpacity(name: string, pose: PartPose | undefined): number {
	return pose?.o ?? (HIDDEN_PARTS.has(name) ? 0 : 1);
}
