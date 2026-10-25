import type { ApiError, Profile } from "./api";

export const CONFLICT_CODE = "CONFLICT";

export interface ConflictInfo {
	message: string;
	/** Which fields were changed elsewhere, with the version and value now stored. */
	fields: Record<string, { version: number; value: unknown }>;
	/** The latest profile, when the server sent it, so the screen can refresh without another request. */
	user: Profile | null;
}

/** Reads a "changed somewhere else" response, or returns null when the error is something else. */
export function conflictFrom(status: number, body: ApiError): ConflictInfo | null {
	const error = body.error as { code?: string; message?: string; details?: { fields?: ConflictInfo["fields"]; user?: Profile } } | undefined;
	if (status !== 409 || error?.code !== CONFLICT_CODE) return null;
	return {
		message: "This was changed somewhere else, so your change wasn't applied. The latest values are shown; make the change again if you still want it.",
		fields: error.details?.fields ?? {},
		user: error.details?.user ?? null,
	};
}

/** The versions of just the fields being changed, as the server expects them (`expectedVersions`). */
export function versionsFor(fieldVersions: Record<string, number> | undefined, fields: string[]): Record<string, number> {
	return Object.fromEntries(fields.map((field) => [field, fieldVersions?.[field] ?? 0]));
}
