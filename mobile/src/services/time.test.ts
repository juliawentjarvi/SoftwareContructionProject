import { describe, expect, it } from "vitest";
import { deviceTimeZone, formatMealTime, isTimeZone, localPartsInZone, zonedTimeToIso } from "./time";

describe("time zones", () => {
	it("converts a local date and time in a zone to the exact instant, across daylight saving", () => {
		expect(zonedTimeToIso("2026-10-01", 8, 0, "Europe/Stockholm")).toBe("2026-10-01T06:00:00.000Z");
		expect(zonedTimeToIso("2026-12-01", 8, 0, "Europe/Stockholm")).toBe("2026-12-01T07:00:00.000Z");
		expect(zonedTimeToIso("2026-07-04", 23, 30, "America/New_York")).toBe("2026-07-05T03:30:00.000Z");
		expect(zonedTimeToIso("2026-10-01", 8, 0, "UTC")).toBe("2026-10-01T08:00:00.000Z");
	});

	it("rejects impossible dates and times", () => {
		expect(zonedTimeToIso("2026-02-30", 8, 0, "UTC")).toBeNull();
		expect(zonedTimeToIso("nope", 8, 0, "UTC")).toBeNull();
		expect(zonedTimeToIso("2026-10-01", 24, 0, "UTC")).toBeNull();
		expect(zonedTimeToIso("2026-10-01", 8, 60, "UTC")).toBeNull();
		expect(zonedTimeToIso("2026-10-01", 8.5, 0, "UTC")).toBeNull();
	});

	it("reads local date and time parts for an instant in a zone", () => {
		expect(localPartsInZone("2026-10-01T22:30:00.000Z", "Europe/Stockholm")).toEqual({ date: "2026-10-02", hour: 0, minute: 30 });
	});

	it("round-trips local entry through the stored instant", () => {
		const iso = zonedTimeToIso("2026-03-29", 3, 15, "Europe/Stockholm")!;
		expect(localPartsInZone(iso, "Europe/Stockholm")).toEqual({ date: "2026-03-29", hour: 3, minute: 15 });
	});

	it("shows the same stored instant in whichever timezone the profile uses, with its zone name", () => {
		const iso = "2026-10-01T06:00:00.000Z";
		expect(formatMealTime(iso, "Europe/Stockholm")).toMatch(/08[:.]00/);
		expect(formatMealTime(iso, "America/New_York")).toMatch(/02[:.]00/);
		expect(formatMealTime(iso, "Europe/Stockholm")).not.toBe(formatMealTime(iso, "America/New_York"));
		expect(formatMealTime("garbage", "UTC")).toBe("Unknown time");
	});

	it("validates timezone names and finds a device timezone", () => {
		expect(isTimeZone("Europe/Stockholm")).toBe(true);
		expect(isTimeZone("Mars/Olympus")).toBe(false);
		expect(isTimeZone("")).toBe(false);
		expect(isTimeZone(deviceTimeZone())).toBe(true);
	});
});
