import { describe, expect, it, vi } from "vitest";
import { PoseStore } from "./poseStore";

describe("PoseStore", () => {
	it("notifies only the parts whose pose changed", () => {
		const store = new PoseStore();
		const main = vi.fn();
		const eyes = vi.fn();
		store.subscribe("main", main);
		store.subscribe("leftEye", eyes);

		store.apply({ main: { sy: 1.004 } });
		expect(main).toHaveBeenCalledTimes(1);
		expect(eyes).not.toHaveBeenCalled();
		expect(store.get("main")).toEqual({ sy: 1.004 });
	});

	it("does not notify when the pose is unchanged between frames", () => {
		const store = new PoseStore();
		const main = vi.fn();
		store.subscribe("main", main);
		store.apply({ main: { sy: 1.004, r: 0 } });
		store.apply({ main: { sy: 1.004, r: 0 } });
		store.apply({ main: { sy: 1.0040000001, r: 0 } });
		expect(main).toHaveBeenCalledTimes(1);
	});

	it("returns a part to rest (undefined) when it drops out of the pose", () => {
		const store = new PoseStore();
		const eye = vi.fn();
		store.subscribe("leftEye", eye);
		store.apply({ leftEye: { sy: 0.2 } });
		store.apply({});
		expect(store.get("leftEye")).toBeUndefined();
		expect(eye).toHaveBeenCalledTimes(2);
	});

	it("stops notifying after unsubscribing", () => {
		const store = new PoseStore();
		const main = vi.fn();
		const off = store.subscribe("main", main);
		off();
		store.apply({ main: { y: 5 } });
		expect(main).not.toHaveBeenCalled();
	});

	it("keeps the same object for an unchanged part so React can skip rendering it", () => {
		const store = new PoseStore();
		store.apply({ main: { sy: 1.01 }, headAll: { r: 2 } });
		const before = store.get("headAll");
		store.apply({ main: { sy: 1.02 }, headAll: { r: 2 } });
		expect(store.get("headAll")).toBe(before);
	});
});
