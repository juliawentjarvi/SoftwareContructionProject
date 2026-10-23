import React, { useEffect, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import LoginScreen from "./login";
import RegisterScreen from "./register";
import MealsScreen from "./meals";
import SettingsScreen from "./settings";
import { Bear } from "../src/components/bear/Bear";
import api, { AuthSession, errorMessage, Profile, ProgressSummary } from "../src/services/api";
import { clearMealReminders, remindersAvailable, requestReminderPermission, scheduleMealReminders } from "../src/services/reminders";

type AppView = "home" | "meals" | "settings";

export default function App() {
	const canScheduleReminders = remindersAvailable();
	const [session, setSession] = useState<AuthSession | null>(null);
	const [authMode, setAuthMode] = useState<"login" | "register">("login");
	const [view, setView] = useState<AppView>("home");
	const [progress, setProgress] = useState<ProgressSummary | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [feedSignal, setFeedSignal] = useState(0);
	const [emoteSignal, setEmoteSignal] = useState(0);
	const [savedOffer, setSavedOffer] = useState(false);

	const authenticate = async (nextSession: AuthSession) => {
		setSession(nextSession);
		setView("home");
		if (nextSession.user.notificationsEnabled && await requestReminderPermission()) {
			await scheduleMealReminders(nextSession.user.reminderTimes);
		}
	};

	useEffect(() => {
		if (!session || view !== "home") return;
		let active = true;
		void api.getProgress(session.accessToken).then((result) => {
			if (active && result.ok) setProgress(result.body.progress);
		});
		return () => { active = false; };
	}, [session, view]);

	// The "log another meal" offer after a save disappears on its own after seven seconds.
	useEffect(() => {
		if (!savedOffer) return;
		const timer = setTimeout(() => setSavedOffer(false), 7000);
		return () => clearTimeout(timer);
	}, [savedOffer]);

	const toggleReminders = async (enabled: boolean) => {
		if (!session) return;
		if (enabled && !await requestReminderPermission()) {
			setError("Allow notifications in device settings to enable reminders.");
			return;
		}
		const result = await api.updateProfile(session.accessToken, { notificationsEnabled: enabled });
		if (!result.ok) {
			setError(errorMessage(result.body, "Reminder settings could not be saved."));
			return;
		}
		setSession({ ...session, user: result.body.user });
		setError(null);
		if (enabled) await scheduleMealReminders(result.body.user.reminderTimes);
		else await clearMealReminders();
	};

	const updateProfile = (user: Profile) => {
		if (session) setSession({ ...session, user });
	};

	if (!session) {
		if (authMode === "register") return <RegisterScreen onAuthenticated={(value) => void authenticate(value)} onSignIn={() => setAuthMode("login")} />;
		return <LoginScreen onAuthenticated={(value) => void authenticate(value)} onCreateAccount={() => setAuthMode("register")} />;
	}

	const mealCount = progress?.mealCount ?? 0;
	const mealGoal = session.user.dailyMealGoal;
	const energy = Math.min(100, mealCount / mealGoal * 100);
	const care = Math.min(100, (progress?.currentStreakDays ?? 0) / 7 * 100);

	return (
		<View style={styles.app}>
			<View style={styles.header}>
				<Pressable onPress={() => setView("home")} accessibilityRole="button">
					<Text style={styles.appTitle}>Bear Care</Text>
					<Text style={styles.welcome}>A small pause, a little care.</Text>
				</Pressable>
				<View style={styles.headerActions}>
					<View style={styles.reminderToggle}>
						<Text style={styles.reminderLabel}>Remind</Text>
						<Switch value={session.user.notificationsEnabled} onValueChange={(enabled) => void toggleReminders(enabled)} accessibilityLabel="Toggle meal reminders" disabled={!canScheduleReminders} />
					</View>
					<Pressable accessibilityRole="button" accessibilityLabel="Profile and settings" onPress={() => setView("settings")} style={styles.profileButton}><Text style={styles.profileInitial}>{session.user.displayName.slice(0, 1).toUpperCase()}</Text></Pressable>
				</View>
			</View>

			{view === "meals" ? <View style={styles.page}><Pressable onPress={() => setView("home")} style={styles.back}><Text style={styles.backText}>‹  Home</Text></Pressable><MealsScreen token={session.accessToken} timezone={session.user.timezone} onMealSaved={() => { setFeedSignal((n) => n + 1); setSavedOffer(true); setView("home"); }} /></View> : null}
			{view === "settings" ? <View style={styles.page}><Pressable onPress={() => setView("home")} style={styles.back}><Text style={styles.backText}>‹  Home</Text></Pressable><SettingsScreen session={session} onProfileChanged={updateProfile} onAccountDeleted={() => { setSession(null); setView("home"); }} /></View> : null}
			{view === "home" ? <ScrollView style={styles.home} contentContainerStyle={styles.homeContent}>
				{savedOffer ? <View accessibilityRole="alert" style={styles.savedOffer}>
					<Text style={styles.savedText}>Meal saved.</Text>
					<Pressable accessibilityRole="button" onPress={() => { setSavedOffer(false); setView("meals"); }}><Text style={styles.savedAction}>Log another meal</Text></Pressable>
				</View> : null}
				<View style={styles.statusRow}>
					<View style={styles.status}>
						<View style={styles.statusHeading}><Text style={styles.statusLabel}>ENERGY</Text><Text style={styles.statusValue}>{mealCount}/{mealGoal}</Text></View>
						<View style={styles.track}><View style={[styles.fill, styles.energyFill, { width: `${energy}%` }]} /></View>
					</View>
					<View style={styles.status}>
						<View style={styles.statusHeading}><Text style={styles.statusLabel}>CARE STREAK</Text><Text style={styles.statusValue}>{progress?.currentStreakDays ?? 0} days</Text></View>
						<View style={styles.track}><View style={[styles.fill, styles.careFill, { width: `${care}%` }]} /></View>
					</View>
				</View>

				<View style={styles.scene}>
					<View style={styles.sceneTop}><Text style={styles.sceneOverline}>TODAY'S LITTLE CHECK-IN</Text><Text style={styles.sceneDate}>{progress?.date ?? ""}</Text></View>
					<View style={styles.playArea}>
						<Pressable onPress={() => setView("meals")} accessibilityRole="button" style={[styles.sceneObject, styles.bowl]}><Text style={styles.objectIcon}>◡</Text><Text style={styles.objectLabel}>Food bowl</Text></Pressable>
						<View style={styles.bearArea}><Bear height={250} feedSignal={feedSignal} emoteSignal={emoteSignal} /><Text style={styles.bearCaption}>{progress?.goalMet ? "You did enough today." : "I'm here for your next pause."}</Text></View>
						<Pressable onPress={() => { setEmoteSignal((n) => n + 1); Alert.alert("Sudoku", "The puzzle game is not implemented yet."); }} accessibilityRole="button" style={[styles.sceneObject, styles.sudoku]}><Text style={styles.sudokuGrid}>□ □ □</Text><Text style={styles.objectLabel}>Sudoku</Text></Pressable>
					</View>
					<View style={styles.sceneFoot}><Text style={styles.footText}>{progress?.goalMet ? "Today's meal goal is complete." : `${Math.max(0, mealGoal - mealCount)} meal${mealGoal - mealCount === 1 ? "" : "s"} to reach today's goal.`}</Text></View>
				</View>

				<View style={styles.logSection}>
					<View style={styles.logHeading}><View><Text style={styles.sectionKicker}>YOUR ROUTINE</Text><Text style={styles.sectionTitle}>A gentle rhythm</Text></View><Text style={styles.streak}>{progress?.currentStreakDays ?? 0} day streak</Text></View>
					{progress?.lastSevenDays.map((day) => <View key={day.date} style={styles.dayRow}><Text style={styles.dayDate}>{new Date(`${day.date}T12:00:00`).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}</Text><View style={styles.dayTrack}><View style={[styles.dayFill, { width: `${Math.min(100, day.mealCount / mealGoal * 100)}%` }]} /></View><Text style={styles.dayCount}>{day.mealCount}/{mealGoal}</Text></View>)}
				</View>

				<Pressable accessibilityRole="button" style={styles.primaryButton} onPress={() => setView("meals")}><Text style={styles.primaryButtonText}>Log a meal</Text><Text style={styles.buttonArrow}>→</Text></Pressable>
				{error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
			</ScrollView> : null}
		</View>
	);
}

const styles = StyleSheet.create({
	app: { flex: 1, paddingTop: 44, backgroundColor: "#f8f7f0" },
	header: { paddingHorizontal: 22, paddingBottom: 14, flexDirection: "row", justifyContent: "space-between", alignItems: "center", borderBottomWidth: 1, borderColor: "#e3e8e3" },
	appTitle: { color: "#1d2923", fontSize: 21, fontWeight: "800" },
	welcome: { color: "#58665e", fontSize: 12, marginTop: 3 },
	headerActions: { flexDirection: "row", alignItems: "center", gap: 14 },
	reminderToggle: { flexDirection: "row", alignItems: "center", gap: 4 },
	reminderLabel: { color: "#315b49", fontSize: 12, fontWeight: "700" },
	profileButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: "#315b49", justifyContent: "center", alignItems: "center" },
	profileInitial: { color: "#fff", fontWeight: "800", fontSize: 16 },
	page: { flex: 1 },
	back: { paddingHorizontal: 20, paddingTop: 14, paddingBottom: 6 },
	backText: { color: "#315b49", fontSize: 15, fontWeight: "700" },
	home: { flex: 1 },
	homeContent: { width: "100%", maxWidth: 820, alignSelf: "center", paddingHorizontal: 20, paddingVertical: 18, paddingBottom: 36 },
	savedOffer: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", backgroundColor: "#e1eee5", borderRadius: 6, paddingHorizontal: 14, paddingVertical: 10, marginBottom: 8 },
	savedText: { color: "#315b49", fontWeight: "700", fontSize: 13 },
	savedAction: { color: "#a34b36", fontWeight: "800", fontSize: 13 },
	statusRow: { flexDirection: "row", gap: 16 },
	status: { flex: 1, paddingVertical: 8 },
	statusHeading: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", marginBottom: 7 },
	statusLabel: { color: "#58665e", fontSize: 10, fontWeight: "800", letterSpacing: 1 },
	statusValue: { color: "#1d2923", fontSize: 13, fontWeight: "700" },
	track: { height: 9, backgroundColor: "#e2e8df", borderRadius: 5, overflow: "hidden" },
	fill: { height: "100%", borderRadius: 5 },
	energyFill: { backgroundColor: "#c5523e" },
	careFill: { backgroundColor: "#5f9275" },
	scene: { marginTop: 18, backgroundColor: "#e9efe6", borderRadius: 8, borderWidth: 1, borderColor: "#d7e1d4", overflow: "hidden" },
	sceneTop: { paddingHorizontal: 18, paddingTop: 16, flexDirection: "row", justifyContent: "space-between" },
	sceneOverline: { color: "#58665e", fontSize: 10, fontWeight: "800", letterSpacing: 1 },
	sceneDate: { color: "#58665e", fontSize: 11 },
	playArea: { minHeight: 270, paddingHorizontal: 14, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 4 },
	sceneObject: { width: 82, minHeight: 80, backgroundColor: "#fff", borderRadius: 8, justifyContent: "center", alignItems: "center", borderWidth: 1, borderColor: "#e1e7dd" },
	bowl: { transform: [{ rotate: "-4deg" }] },
	sudoku: { transform: [{ rotate: "3deg" }] },
	objectIcon: { color: "#c5523e", fontSize: 32, lineHeight: 38, fontWeight: "700" },
	objectLabel: { color: "#58665e", fontSize: 11, fontWeight: "700" },
	sudokuGrid: { color: "#315b49", fontSize: 16, lineHeight: 30, fontWeight: "700" },
	bearArea: { flex: 1, alignItems: "center", justifyContent: "center", minWidth: 120 },
	bearCaption: { color: "#58665e", fontSize: 12, marginTop: 8, textAlign: "center" },
	sceneFoot: { borderTopWidth: 1, borderColor: "#d7e1d4", paddingHorizontal: 18, paddingVertical: 11 },
	footText: { color: "#315b49", fontSize: 12, fontWeight: "600" },
	logSection: { paddingTop: 24, paddingBottom: 18 },
	logHeading: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 10 },
	sectionKicker: { color: "#a34b36", fontSize: 10, fontWeight: "800", letterSpacing: 1.3 },
	sectionTitle: { color: "#1d2923", fontSize: 19, fontWeight: "700", marginTop: 3 },
	streak: { color: "#315b49", fontSize: 12, fontWeight: "700" },
	dayRow: { minHeight: 32, flexDirection: "row", alignItems: "center", gap: 10 },
	dayDate: { width: 92, color: "#58665e", fontSize: 12 },
	dayTrack: { flex: 1, height: 6, backgroundColor: "#e2e8df", borderRadius: 4, overflow: "hidden" },
	dayFill: { height: "100%", backgroundColor: "#5f9275", borderRadius: 4 },
	dayCount: { width: 34, color: "#58665e", textAlign: "right", fontSize: 11, fontWeight: "600" },
	primaryButton: { minHeight: 50, backgroundColor: "#c5523e", borderRadius: 6, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 10 },
	primaryButtonText: { color: "#fff", fontSize: 15, fontWeight: "700" },
	buttonArrow: { color: "#fff", fontSize: 17 },
	error: { color: "#a6372d", textAlign: "center", marginTop: 10 },
});
