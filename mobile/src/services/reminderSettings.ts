import api, { errorMessage, Profile } from "./api";
import { disableMealReminders, enableMealReminders, ReminderResult } from "./reminders";

/** On failure `user` is the latest profile the server confirmed, when the failure changed it. */
export type ReminderOutcome = { ok: true; user: Profile } | { ok: false; message: string; user?: Profile };

export interface ReminderDeps {
	updateProfile: typeof api.updateProfile;
	enable: (times: string[]) => Promise<ReminderResult>;
	disable: () => Promise<ReminderResult>;
}

const defaults: ReminderDeps = { updateProfile: api.updateProfile, enable: enableMealReminders, disable: disableMealReminders };

/**
 * The one place that turns reminders on or off, used by the home toggle and the settings switch so they cannot disagree.
 * Reminders are only reported as on when the device schedule AND the saved preference both succeeded; a failure leaves
 * the previous state in place and is explained.
 */
export async function setRemindersEnabled(token: string, user: Profile, enabled: boolean, deps: ReminderDeps = defaults): Promise<ReminderOutcome> {
	if (enabled) {
		const scheduled = await deps.enable(user.reminderTimes);
		if (!scheduled.ok) {
			const off = user.notificationsEnabled ? await deps.updateProfile(token, { notificationsEnabled: false }) : null;
			return { ok: false, message: scheduled.message, ...(off?.ok ? { user: off.body.user } : {}) };
		}
		const saved = await deps.updateProfile(token, { notificationsEnabled: true });
		if (!saved.ok) {
			await deps.disable();
			return { ok: false, message: errorMessage(saved.body, "Your reminder setting couldn't be saved. Reminders are still off.") };
		}
		return { ok: true, user: saved.body.user };
	}

	const cancelled = await deps.disable();
	if (!cancelled.ok) return { ok: false, message: cancelled.message };
	const saved = await deps.updateProfile(token, { notificationsEnabled: false });
	if (!saved.ok) {
		if (user.notificationsEnabled) await deps.enable(user.reminderTimes); // keep device and saved setting in step
		return { ok: false, message: errorMessage(saved.body, "Your reminder setting couldn't be saved. Reminders are still on.") };
	}
	return { ok: true, user: saved.body.user };
}

/** Saves new reminder times and, when reminders are on, reschedules the device to match. */
export async function saveReminderTimes(token: string, user: Profile, times: string[], deps: ReminderDeps = defaults): Promise<ReminderOutcome> {
	const saved = await deps.updateProfile(token, { reminderTimes: times });
	if (!saved.ok) return { ok: false, message: errorMessage(saved.body, "Your reminder times couldn't be saved.") };
	if (!user.notificationsEnabled) return { ok: true, user: saved.body.user };

	const scheduled = await deps.enable(saved.body.user.reminderTimes);
	if (scheduled.ok) return { ok: true, user: saved.body.user };
	const off = await deps.updateProfile(token, { notificationsEnabled: false });
	return {
		ok: false,
		message: `${scheduled.message} Your new times were saved, but reminders are off.`,
		user: off.ok ? off.body.user : saved.body.user,
	};
}

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Checks reminder times typed by the user. Returns the cleaned list, or a message explaining what to fix. */
export function checkReminderTimes(input: string[]): { ok: true; times: string[] } | { ok: false; message: string } {
	const times = input.map((time) => time.trim());
	if (times.length < 1 || times.length > 8 || times.some((time) => !TIME_PATTERN.test(time))) {
		return { ok: false, message: "Enter between one and eight times in 24-hour format, such as 09:00." };
	}
	if (new Set(times).size !== times.length) return { ok: false, message: "Each reminder needs a different time." };
	return { ok: true, times };
}
