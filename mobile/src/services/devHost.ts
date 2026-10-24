/** The API runs next to the Expo dev server on this port (see server/.env PORT). */
export const API_PORT = 3000;

/**
 * Work out the API address from the host the app itself was loaded from, so a phone (Expo Go) or another
 * computer (web) finds the API on the development machine without configuration.
 * `hostUri` looks like "192.168.1.23:8081" (Expo Go) or is a page hostname (web). Returns null when it cannot
 * point at the development machine, such as an Expo tunnel address.
 */
export function apiBaseFromHost(hostUri: string | null | undefined, port = API_PORT): string | null {
	if (!hostUri) return null;
	const withoutScheme = hostUri.trim().replace(/^[a-z][a-z0-9+.-]*:\/\//i, "");
	const host = withoutScheme.split("/")[0]?.replace(/:\d+$/, "");
	if (!host || /[\s@]/.test(host)) return null;
	// Tunnels forward the Metro bundler only, not the API.
	if (/(\.exp\.direct|\.ngrok[\w-]*\.(io|app|dev)|\.trycloudflare\.com|\.loca\.lt)$/i.test(host)) return null;
	const bracketed = host.includes(":") && !host.startsWith("[") ? `[${host}]` : host;
	return `http://${bracketed}:${port}/api`;
}
