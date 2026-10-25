import { describe, expect, it } from "vitest";
import { THEMES, sceneTheme } from "./themes";

describe("scene themes", () => {
	it("falls back to the default meadow for an unknown or missing theme", () => {
		expect(sceneTheme(undefined)).toBe(THEMES.meadow);
		expect(sceneTheme(null)).toBe(THEMES.meadow);
		expect(sceneTheme("not-a-theme")).toBe(THEMES.meadow);
		expect(sceneTheme("night")).toBe(THEMES.night);
	});

	it("covers the themes the server sells", () => {
		for (const id of ["meadow", "sunset", "night", "berry"]) expect(THEMES[id]).toBeDefined();
	});
});
