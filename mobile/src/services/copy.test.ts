import { describe, expect, it } from "vitest";
import { ANIMATE_DESCRIPTION, PASSWORD_SAFEKEEPING_NOTICE, REMINDERS_NOT_READY_NOTE } from "./copy";

describe("user-facing copy", () => {
	it("tells new users to remember or write down their password and admits recovery is not ready", () => {
		expect(PASSWORD_SAFEKEEPING_NOTICE).toMatch(/remember/i);
		expect(PASSWORD_SAFEKEEPING_NOTICE).toMatch(/write/i);
		expect(PASSWORD_SAFEKEEPING_NOTICE).toMatch(/safe/i);
		expect(PASSWORD_SAFEKEEPING_NOTICE).toMatch(/figuring/i);
	});

	it("says plainly that reminders are not working yet", () => {
		expect(REMINDERS_NOT_READY_NOTE).toMatch(/still being figured out/i);
	});

	it("describes the animate switch", () => {
		expect(ANIMATE_DESCRIPTION).toMatch(/breath/i);
	});
});
