import { disableMealReminders } from "./reminders";
import { clearAccessToken } from "./sessionVault";

interface Deps {
	clearToken: () => Promise<void>;
	cancelReminders: () => Promise<unknown>;
}

const defaults: Deps = { clearToken: clearAccessToken, cancelReminders: disableMealReminders };

/**
 * Log out: remove what this device remembers about the signed-in user and cancel any scheduled reminders.
 * The account and its records on the server are untouched, and the (stateless) access token simply expires.
 * Never throws; clean-up problems must not stop a person from logging out.
 */
export async function endSession(deps: Deps = defaults): Promise<void> {
	await Promise.allSettled([deps.clearToken(), deps.cancelReminders()]);
}
