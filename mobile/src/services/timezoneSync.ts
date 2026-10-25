import api, { Profile } from "./api";
import { deviceTimeZone } from "./time";

export type TimezoneSync = { changed: false; failed?: true } | { changed: true; user: Profile };

interface Deps {
	updateProfile: typeof api.updateProfile;
	deviceTimeZone: () => string;
}

const defaults: Deps = { updateProfile: api.updateProfile, deviceTimeZone };

/**
 * The device's timezone is the only timezone setting: when the account's stored zone differs (a new country, or an
 * account created before this was automatic) it is updated so day boundaries and displayed times agree with the device.
 * Failure is reported, never thrown, so signing in is never blocked by it.
 */
export async function syncTimezone(token: string, user: Profile, deps: Deps = defaults): Promise<TimezoneSync> {
	const zone = deps.deviceTimeZone();
	if (user.timezone === zone) return { changed: false };
	const result = await deps.updateProfile(token, { timezone: zone });
	if (!result.ok) return { changed: false, failed: true };
	return { changed: true, user: result.body.user };
}
