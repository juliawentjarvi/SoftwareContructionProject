import api, { AuthSession } from "./api";
import { clearAccessToken, loadAccessToken, saveAccessToken } from "./sessionVault";

export type RestoreResult =
	| { status: "signed-out" }
	| { status: "signed-in"; session: AuthSession }
	| { status: "unreachable"; message: string };

interface Deps {
	loadToken: () => Promise<string | null>;
	saveToken: (token: string) => Promise<void>;
	clearToken: () => Promise<void>;
	refresh: typeof api.refreshSession;
}

const defaults: Deps = { loadToken: loadAccessToken, saveToken: saveAccessToken, clearToken: clearAccessToken, refresh: api.refreshSession };

/**
 * On launch: sign back in with the stored token if the server still accepts it.
 * A rejected token (expired, or the account is gone) is forgotten. If the server cannot be reached the token is kept and
 * the app says so, instead of logging the person out because of a network problem.
 */
export async function restoreSession(deps: Deps = defaults): Promise<RestoreResult> {
	const token = await deps.loadToken();
	if (!token) return { status: "signed-out" };

	const result = await deps.refresh(token);
	if (result.ok) {
		await deps.saveToken(result.body.accessToken);
		return { status: "signed-in", session: result.body };
	}
	if (result.status === 401) {
		await deps.clearToken();
		return { status: "signed-out" };
	}
	return { status: "unreachable", message: "Can't reach the Bear Care server right now. You're still signed in; check your connection and try again." };
}
