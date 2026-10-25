/** Scene colours for each theme the player can unlock (ids match the server's reward catalog). */
export interface SceneTheme {
	background: string;
	border: string;
	text: string;
	mutedText: string;
}

export const THEMES: Record<string, SceneTheme> = {
	meadow: { background: "#e9efe6", border: "#d7e1d4", text: "#315b49", mutedText: "#58665e" },
	sunset: { background: "#f6d9c5", border: "#ecc1a2", text: "#7a3b22", mutedText: "#8a5a45" },
	night: { background: "#27324d", border: "#3a4868", text: "#e8ecff", mutedText: "#b9c3e6" },
	berry: { background: "#ead3e4", border: "#d9b4cf", text: "#5c2a52", mutedText: "#7d5a75" },
};

export function sceneTheme(id: string | null | undefined): SceneTheme {
	return (id && THEMES[id]) || THEMES.meadow!;
}
