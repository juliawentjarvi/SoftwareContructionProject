/**
 * Logic for what happens when someone taps a meal reminder or answers its "Log a meal" action.
 * Kept free of native modules so it can be tested; native glue lives in reminders.ts and notificationListener.ts.
 */

export const MEAL_CATEGORY = "meal-reminder";
export const LOG_MEAL_ACTION = "log-meal";
/** Same value as Notifications.DEFAULT_ACTION_IDENTIFIER: the user tapped the notification itself. */
export const DEFAULT_ACTION = "expo.modules.notifications.actions.DEFAULT";

export interface NotificationResponseLike {
	actionIdentifier: string;
	userText?: string | undefined;
	notification: { request: { identifier: string } };
}

export type NotificationIntent =
	| { kind: "open-meals" }
	| { kind: "log-meal"; name: string; key: string }
	| { kind: "ignore" };

export const MAX_MEAL_NAME = 100;

/** Decide what a notification response means. Text typed into the action becomes a meal name. */
export function intentFromResponse(response: NotificationResponseLike): NotificationIntent {
	if (response.actionIdentifier === DEFAULT_ACTION) return { kind: "open-meals" };
	if (response.actionIdentifier !== LOG_MEAL_ACTION) return { kind: "ignore" };
	const name = (response.userText ?? "").trim().slice(0, MAX_MEAL_NAME);
	if (!name) return { kind: "open-meals" }; // nothing typed: let the person log it in the app
	return { kind: "log-meal", name, key: `${response.notification.request.identifier}:${response.actionIdentifier}:${name}` };
}

/** Meal type guessed from the local hour, since the reminder action only asks for a name. */
export function mealTypeForHour(hour: number): "breakfast" | "lunch" | "dinner" | "snack" {
	if (hour >= 5 && hour < 11) return "breakfast";
	if (hour >= 11 && hour < 15) return "lunch";
	if (hour >= 17 && hour < 21) return "dinner";
	return "snack";
}

export type ActionOutcome =
	| { status: "open-meals" }
	| { status: "ignored" }
	| { status: "duplicate" }
	| { status: "needs-sign-in"; name: string }
	| { status: "logged"; name: string }
	| { status: "failed"; name: string };

export interface ActionDeps {
	loadToken: () => Promise<string | null>;
	createMeal: (token: string, name: string, mealType: "breakfast" | "lunch" | "dinner" | "snack", eatenAt: string) => Promise<{ ok: boolean }>;
	/** Keys of actions already handled; survives app restarts so a re-delivered response is not applied twice. */
	loadHandled: () => Promise<string | null>;
	saveHandled: (key: string) => Promise<void>;
	now?: () => Date;
}

/**
 * Apply a notification response. A meal is sent at most once per response: the key is recorded before the request is
 * made and a failed request is reported, never silently retried, so a lost reply cannot create duplicate meals.
 */
export async function handleNotificationResponse(response: NotificationResponseLike, deps: ActionDeps): Promise<ActionOutcome> {
	const intent = intentFromResponse(response);
	if (intent.kind === "ignore") return { status: "ignored" };
	if (intent.kind === "open-meals") return { status: "open-meals" };

	if ((await deps.loadHandled()) === intent.key) return { status: "duplicate" };
	await deps.saveHandled(intent.key);

	const token = await deps.loadToken();
	if (!token) return { status: "needs-sign-in", name: intent.name };

	const when = (deps.now ?? (() => new Date()))();
	const result = await deps.createMeal(token, intent.name, mealTypeForHour(when.getHours()), when.toISOString());
	return result.ok ? { status: "logged", name: intent.name } : { status: "failed", name: intent.name };
}
