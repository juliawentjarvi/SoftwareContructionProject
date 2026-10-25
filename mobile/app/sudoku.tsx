import React, { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import api from "../src/services/api";
import { Board, boardStatus, conflictCells, disabledDigits, placeDigit } from "../src/services/sudoku";
import { SavedGame, completeGame, realSudokuDeps, startOrResumeGame } from "../src/services/sudokuGame";

export default function SudokuScreen({ token, onChanged }: { token: string; onChanged?: () => void }) {
	const { width } = useWindowDimensions();
	const cell = Math.floor(Math.min(width - 40, 420) / 9);
	const [game, setGame] = useState<SavedGame | null>(null);
	const [hasSaved, setHasSaved] = useState(false);
	const [selected, setSelected] = useState<number | null>(null);
	const [busy, setBusy] = useState(false);
	const [message, setMessage] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [won, setWon] = useState(false);
	const [reward, setReward] = useState<number | null>(null);
	const [points, setPoints] = useState<number | null>(null);

	useEffect(() => {
		void realSudokuDeps.load().then((saved) => setHasSaved(Boolean(saved?.started)));
		void api.getRewards(token).then((result) => { if (result.ok) setPoints(result.body.points); });
	}, [token]);

	const locked = new Set<number>();
	game?.puzzle.forEach((value, i) => { if (value !== 0) locked.add(i); });
	const red = game ? conflictCells(game.board) : [];
	const muted = game ? disabledDigits(game.board) : [];

	const start = async () => {
		setBusy(true);
		setError(null);
		setMessage(null);
		const result = await startOrResumeGame(token);
		setBusy(false);
		if (!result.ok) { setError(result.message); return; }
		setGame(result.game);
		setWon(false);
		setReward(null);
		setSelected(null);
		if (!result.resumed) onChanged?.(); // the 5 energy was charged
	};

	const finish = async () => {
		setBusy(true);
		const result = await completeGame(token);
		setBusy(false);
		if (!result.ok) { setError(result.message); return; }
		setError(null);
		setReward(result.awarded);
		setPoints(result.points);
		setHasSaved(false);
		onChanged?.();
	};

	const choose = async (digit: number) => {
		if (!game || selected === null || won) return;
		const board: Board = placeDigit(game.board, selected, digit, locked);
		if (board === game.board) return;
		const next = { ...game, board };
		setGame(next);
		await realSudokuDeps.save(next);
		const status = boardStatus(board);
		if (status.status === "win") {
			setWon(true);
			setMessage("Solved! The bear is delighted.");
			await finish();
		} else if (status.status === "incorrect") {
			setMessage("Not quite: the red numbers clash with others in their row, column or box. Change one and try again.");
		} else {
			setMessage(null);
		}
	};

	return (
		<View style={styles.container}>
			<Text style={styles.kicker}>A LITTLE BREAK</Text>
			<Text style={styles.title}>Sudoku</Text>
			<Text style={styles.subtitle}>Starting a game uses 5 energy; finishing one earns reward points{points !== null ? ` (you have ${points})` : ""}. Resuming a game costs nothing.</Text>

			{!game ? (
				<View>
					<Pressable accessibilityRole="button" onPress={() => void start()} disabled={busy} style={[styles.primary, busy && styles.disabled]}>
						{busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>{hasSaved ? "Resume your game" : "Start a game (5 energy)"}</Text>}
					</Pressable>
					{error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
				</View>
			) : (
				<View>
					<View style={[styles.grid, { width: cell * 9 + 2, height: cell * 9 + 2 }]}>
						{game.board.map((value, i) => {
							const row = Math.floor(i / 9);
							const col = i % 9;
							return (
								<Pressable
									key={i}
									accessibilityRole="button"
									accessibilityLabel={`Row ${row + 1} column ${col + 1}${value ? `, ${value}` : ", empty"}${red[i] ? ", clashes" : ""}`}
									onPress={() => setSelected(i)}
									style={[
										styles.cell,
										{ width: cell, height: cell },
										col % 3 === 0 && styles.leftEdge,
										row % 3 === 0 && styles.topEdge,
										col === 8 && styles.rightEdge,
										row === 8 && styles.bottomEdge,
										selected === i && styles.selected,
									]}
								>
									<Text style={[styles.digit, locked.has(i) && styles.given, red[i] && styles.red, { fontSize: cell * 0.5 }]}>{value || ""}</Text>
								</Pressable>
							);
						})}
					</View>

					<View style={styles.pad}>
						{[1, 2, 3, 4, 5, 6, 7, 8, 9].map((digit) => (
							<Pressable
								key={digit}
								accessibilityRole="button"
								accessibilityLabel={`Digit ${digit}${muted[digit] ? " (already in every box)" : ""}`}
								disabled={Boolean(muted[digit]) || selected === null || won || busy}
								onPress={() => void choose(digit)}
								style={[styles.padKey, muted[digit] && styles.padKeyMuted]}
							>
								<Text style={[styles.padText, muted[digit] && styles.padTextMuted]}>{digit}</Text>
							</Pressable>
						))}
						<Pressable accessibilityRole="button" accessibilityLabel="Erase" disabled={selected === null || won || busy} onPress={() => void choose(0)} style={styles.padKey}>
							<Text style={styles.padText}>⌫</Text>
						</Pressable>
					</View>

					{message ? <Text accessibilityRole="alert" style={won ? styles.success : styles.notice}>{message}</Text> : null}
					{won && reward !== null ? <Text style={styles.success}>{reward > 0 ? `+${reward} reward points!` : "Reward points were already counted for this game."}</Text> : null}
					{error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
					{won && reward === null ? (
						<Pressable accessibilityRole="button" onPress={() => void finish()} disabled={busy} style={[styles.primary, busy && styles.disabled]}><Text style={styles.primaryText}>Save my result</Text></Pressable>
					) : null}
					{won && reward !== null ? (
						<Pressable accessibilityRole="button" onPress={() => { setGame(null); setMessage(null); setWon(false); setReward(null); }} style={styles.primary}><Text style={styles.primaryText}>Play again (5 energy)</Text></Pressable>
					) : null}
				</View>
			)}
		</View>
	);
}

const styles = StyleSheet.create({
	container: { flex: 1, padding: 20, backgroundColor: "#f8f7f0" },
	kicker: { color: "#a34b36", fontSize: 11, fontWeight: "800", letterSpacing: 1.5 },
	title: { color: "#1d2923", fontSize: 28, fontWeight: "700", marginTop: 5 },
	subtitle: { color: "#58665e", fontSize: 14, marginTop: 5, marginBottom: 16 },
	primary: { minHeight: 48, backgroundColor: "#315b49", borderRadius: 6, alignItems: "center", justifyContent: "center", marginTop: 14, paddingHorizontal: 16 },
	primaryText: { color: "#fff", fontWeight: "700", fontSize: 15 },
	disabled: { opacity: 0.7 },
	grid: { flexDirection: "row", flexWrap: "wrap", borderWidth: 1, borderColor: "#1d2923", backgroundColor: "#fff", alignSelf: "center" },
	cell: { alignItems: "center", justifyContent: "center", borderWidth: StyleSheet.hairlineWidth, borderColor: "#aab8ad" },
	leftEdge: { borderLeftWidth: 2, borderLeftColor: "#1d2923" },
	topEdge: { borderTopWidth: 2, borderTopColor: "#1d2923" },
	rightEdge: { borderRightWidth: 2, borderRightColor: "#1d2923" },
	bottomEdge: { borderBottomWidth: 2, borderBottomColor: "#1d2923" },
	selected: { backgroundColor: "#dcebe0" },
	digit: { color: "#315b49", fontWeight: "600" },
	given: { color: "#1d2923", fontWeight: "800" },
	red: { color: "#c0392b" },
	pad: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 8, marginTop: 16 },
	padKey: { width: 52, height: 48, borderRadius: 6, borderWidth: 1, borderColor: "#315b49", backgroundColor: "#fff", alignItems: "center", justifyContent: "center" },
	padKeyMuted: { backgroundColor: "#e8ece8", borderColor: "#cbd6cd" },
	padText: { color: "#315b49", fontSize: 20, fontWeight: "700" },
	padTextMuted: { color: "#9aa59d" },
	error: { color: "#a6372d", marginTop: 12 },
	notice: { color: "#a34b36", marginTop: 12 },
	success: { color: "#315b49", fontWeight: "700", marginTop: 12 },
});
