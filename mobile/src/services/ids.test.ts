import { describe, expect, it } from "vitest";
import { uuid4 } from "./ids";

describe("uuid4", () => {
	it("looks like a version-4 id and differs each time", () => {
		const id = uuid4();
		expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
		expect(uuid4()).not.toBe(id);
	});
});
