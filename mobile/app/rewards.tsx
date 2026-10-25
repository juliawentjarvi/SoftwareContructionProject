import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import api, { CatalogItem, Profile, RewardsState, errorMessage } from "../src/services/api";
import { uuid4 } from "../src/services/ids";

interface Props {
	token: string;
	user: Profile;
	onProfileChanged: (user: Profile) => void;
	/** Called after a treat was bought so the bear can enjoy it. */
	onTreat: () => void;
}

const SECTIONS: { kind: CatalogItem["kind"]; title: string; blurb: string }[] = [
	{ kind: "treat", title: "Treats", blurb: "Buy as many as you like; the bear loves them." },
	{ kind: "appearance", title: "Looks", blurb: "Unlock once, then wear or take off." },
	{ kind: "theme", title: "Backgrounds", blurb: "Unlock once, then pick your favourite scene." },
];

export default function RewardsScreen({ token, user, onProfileChanged, onTreat }: Props) {
	const [state, setState] = useState<RewardsState | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [busy, setBusy] = useState<string | null>(null);

	const load = useCallback(async () => {
		const result = await api.getRewards(token);
		if (result.ok) { setState(result.body); setError(null); }
		else setError(errorMessage(result.body, "The shop couldn't be loaded. Check your connection and try again."));
	}, [token]);

	useEffect(() => { void load(); }, [load]);

	const buy = async (item: CatalogItem) => {
		setBusy(item.id);
		setError(null);
		const result = await api.unlockItem(token, item.id, item.kind === "treat" ? uuid4() : undefined);
		setBusy(null);
		if (!result.ok) { setError(errorMessage(result.body, "That didn't go through, and no points were spent unless it says so. Try again.")); await load(); return; }
		await load();
		if (item.kind === "treat") onTreat();
	};

	const choose = async (item: CatalogItem, on: boolean) => {
		setBusy(item.id);
		setError(null);
		const changes = item.kind === "theme" ? { selectedTheme: item.id } : { selectedAccessory: on ? item.id : null };
		const result = await api.updateProfile(token, changes);
		setBusy(null);
		if (!result.ok) { setError(errorMessage(result.body, "That couldn't be saved. Try again.")); return; }
		onProfileChanged(result.body.user);
	};

	return (
		<ScrollView style={styles.screen} contentContainerStyle={styles.content}>
			<Text style={styles.kicker}>YOUR REWARDS</Text>
			<Text style={styles.title}>Bear shop</Text>
			<Text accessibilityLabel="Reward points" style={styles.points}>{state ? `${state.points} reward points` : "..."}</Text>
			<Text style={styles.subtitle}>Finish a Sudoku game to earn 10 points. Points are separate from energy: spending them never changes your energy.</Text>
			{error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
			{!state && !error ? <ActivityIndicator color="#315b49" /> : null}

			{state ? SECTIONS.map((section) => (
				<View key={section.kind} style={styles.section}>
					<Text style={styles.sectionTitle}>{section.title}</Text>
					<Text style={styles.blurb}>{section.blurb}</Text>
					{state.catalog.filter((item) => item.kind === section.kind).map((item) => {
						const owned = state.unlocked.includes(item.id);
						const worn = item.kind === "appearance" ? user.selectedAccessory === item.id : item.kind === "theme" ? user.selectedTheme === item.id : false;
						const affordable = state.points >= item.cost;
						return (
							<View key={item.id} style={styles.row}>
								<View style={styles.rowText}>
									<Text style={styles.name}>{item.name}</Text>
									<Text style={styles.meta}>
										{item.kind === "treat" ? `${item.cost} points each${state.treats[item.id] ? ` - given ${state.treats[item.id]} time${state.treats[item.id] === 1 ? "" : "s"}` : ""}` : owned ? "Unlocked" : `${item.cost} points`}
									</Text>
								</View>
								{item.kind === "treat" || !owned ? (
									<Pressable accessibilityRole="button" accessibilityLabel={`${item.kind === "treat" ? "Give" : "Unlock"} ${item.name}`} disabled={!affordable || busy !== null} onPress={() => void buy(item)} style={[styles.button, (!affordable || busy !== null) && styles.buttonDisabled]}>
										<Text style={styles.buttonText}>{busy === item.id ? "..." : item.kind === "treat" ? `Give (${item.cost})` : `Unlock (${item.cost})`}</Text>
									</Pressable>
								) : (
									<Pressable accessibilityRole="button" accessibilityLabel={`${worn && item.kind === "appearance" ? "Take off" : item.kind === "appearance" ? "Wear" : "Use"} ${item.name}`} disabled={busy !== null || (worn && item.kind === "theme")} onPress={() => void choose(item, !worn)} style={[styles.button, worn ? styles.buttonOn : null]}>
										<Text style={styles.buttonText}>{worn ? (item.kind === "appearance" ? "Wearing - take off" : "In use") : item.kind === "appearance" ? "Wear" : "Use"}</Text>
									</Pressable>
								)}
							</View>
						);
					})}
				</View>
			)) : null}
		</ScrollView>
	);
}

const styles = StyleSheet.create({
	screen: { flex: 1, backgroundColor: "#f8f7f0" },
	content: { padding: 20, paddingBottom: 40 },
	kicker: { color: "#a34b36", fontSize: 11, fontWeight: "800", letterSpacing: 1.5 },
	title: { color: "#1d2923", fontSize: 28, fontWeight: "700", marginTop: 5 },
	points: { color: "#315b49", fontSize: 18, fontWeight: "800", marginTop: 6 },
	subtitle: { color: "#58665e", fontSize: 13, marginTop: 6, marginBottom: 6 },
	error: { color: "#a6372d", marginTop: 8 },
	section: { borderTopWidth: 1, borderColor: "#dce5dc", marginTop: 18, paddingTop: 14 },
	sectionTitle: { color: "#1d2923", fontSize: 17, fontWeight: "700" },
	blurb: { color: "#58665e", fontSize: 12, marginTop: 3, marginBottom: 8 },
	row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10, paddingVertical: 8 },
	rowText: { flex: 1 },
	name: { color: "#1d2923", fontSize: 15, fontWeight: "700" },
	meta: { color: "#58665e", fontSize: 12, marginTop: 2 },
	button: { minHeight: 40, minWidth: 110, paddingHorizontal: 12, borderRadius: 6, backgroundColor: "#315b49", alignItems: "center", justifyContent: "center" },
	buttonOn: { backgroundColor: "#a34b36" },
	buttonDisabled: { opacity: 0.45 },
	buttonText: { color: "#fff", fontWeight: "700", fontSize: 13 },
});
