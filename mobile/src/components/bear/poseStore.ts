import type { PartPose, Pose } from "./pose";

const EPSILON = 1e-4;
const FIELDS: (keyof PartPose)[] = ["x", "y", "r", "sx", "sy", "o"];

function same(a: PartPose | undefined, b: PartPose | undefined): boolean {
	if (a === b) return true;
	if (!a || !b) return false;
	return FIELDS.every((field) => {
		const x = a[field];
		const y = b[field];
		if (x === undefined || y === undefined) return x === y;
		return Math.abs(x - y) < EPSILON;
	});
}

/**
 * Holds the current pose of every bear part and tells only the parts that changed. This keeps a gentle motion such as
 * breathing cheap: each frame re-renders one part instead of the whole bear.
 */
export class PoseStore {
	private poses = new Map<string, PartPose>();
	private listeners = new Map<string, Set<() => void>>();

	get = (name: string): PartPose | undefined => this.poses.get(name);

	subscribe = (name: string, listener: () => void): (() => void) => {
		let set = this.listeners.get(name);
		if (!set) this.listeners.set(name, (set = new Set()));
		set.add(listener);
		return () => { set.delete(listener); };
	};

	/** Replace the whole pose. Parts missing from `next` return to rest. */
	apply(next: Pose) {
		const changed: string[] = [];
		for (const [name, pose] of Object.entries(next)) {
			if (!same(this.poses.get(name), pose)) {
				this.poses.set(name, pose);
				changed.push(name);
			}
		}
		for (const name of [...this.poses.keys()]) {
			if (!(name in next)) {
				this.poses.delete(name);
				changed.push(name);
			}
		}
		for (const name of changed) this.listeners.get(name)?.forEach((listener) => listener());
	}
}
