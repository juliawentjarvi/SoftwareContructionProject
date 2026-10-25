/** A random version-4 style id made on the device; used so a repeated request can be recognised by the server. */
export function uuid4(): string {
	return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
		const r = Math.floor(Math.random() * 16);
		return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
	});
}
