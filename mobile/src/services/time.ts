/** Date and time helpers that interpret meal times in the profile's IANA timezone. */

export function isTimeZone(value: string): boolean {
	if (!value.trim()) return false;
	try {
		new Intl.DateTimeFormat("en", { timeZone: value });
		return true;
	} catch {
		return false;
	}
}

export function deviceTimeZone(): string {
	try {
		const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
		return zone && isTimeZone(zone) ? zone : "UTC";
	} catch {
		return "UTC";
	}
}

function zoneParts(ms: number, timeZone: string) {
	const parts = new Intl.DateTimeFormat("en-US", {
		timeZone, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit",
	}).formatToParts(new Date(ms));
	const get = (type: string) => Number(parts.find((part) => part.type === type)?.value);
	return { year: get("year"), month: get("month"), day: get("day"), hour: get("hour"), minute: get("minute"), second: get("second") };
}

/** Offset of `timeZone` from UTC at the given instant, in milliseconds (positive east of UTC). */
function offsetMs(ms: number, timeZone: string) {
	const p = zoneParts(ms, timeZone);
	return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - Math.floor(ms / 1000) * 1000;
}

const pad = (n: number) => String(n).padStart(2, "0");

/** Local calendar date (YYYY-MM-DD), hour and minute of an instant in `timeZone`. */
export function localPartsInZone(iso: string | number | Date, timeZone: string) {
	const p = zoneParts(new Date(iso).getTime(), timeZone);
	return { date: `${p.year}-${pad(p.month)}-${pad(p.day)}`, hour: p.hour, minute: p.minute };
}

/** The exact instant (ISO, UTC) for a local date and time in `timeZone`, or null when the input is not a real date and time. */
export function zonedTimeToIso(date: string, hour: number, minute: number, timeZone: string): string | null {
	const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date.trim());
	if (!match || !isTimeZone(timeZone)) return null;
	if (!Number.isInteger(hour) || !Number.isInteger(minute) || hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
	const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
	const check = new Date(Date.UTC(year, month - 1, day));
	if (check.getUTCFullYear() !== year || check.getUTCMonth() !== month - 1 || check.getUTCDate() !== day) return null;

	const guess = Date.UTC(year, month - 1, day, hour, minute);
	// Offsets can differ either side of a daylight-saving change, so settle on the offset that applies at the result.
	let instant = guess - offsetMs(guess, timeZone);
	instant = guess - offsetMs(instant, timeZone);
	return new Date(instant).toISOString();
}

/** Human-readable meal time in `timeZone`, including the zone's short name. */
export function formatMealTime(iso: string, timeZone: string): string {
	const date = new Date(iso);
	if (Number.isNaN(date.getTime())) return "Unknown time";
	return new Intl.DateTimeFormat(undefined, {
		timeZone: isTimeZone(timeZone) ? timeZone : "UTC",
		year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZoneName: "short",
	}).format(date);
}
