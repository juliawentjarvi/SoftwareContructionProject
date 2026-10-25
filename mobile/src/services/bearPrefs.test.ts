import { beforeEach, describe, expect, it, vi } from "vitest";

const store = vi.hoisted(() => new Map<string, string>());
vi.mock("@react-native-async-storage/async-storage", () => ({
	default: {
		getItem: vi.fn(async (key: string) => store.get(key) ?? null),
		setItem: vi.fn(async (key: string, value: string) => { store.set(key, value); }),
	},
}));

import { getAnimate, setAnimate } from "./bearPrefs";

beforeEach(() => store.clear());

describe("animate the bear setting", () => {
	it("is on by default", async () => {
		expect(await getAnimate()).toBe(true);
	});

	it("remembers off and on", async () => {
		await setAnimate(false);
		expect(await getAnimate()).toBe(false);
		await setAnimate(true);
		expect(await getAnimate()).toBe(true);
	});

	it("ignores the old always-animate setting", async () => {
		store.set("bear-care-always-animate", "false");
		expect(await getAnimate()).toBe(true);
	});
});
