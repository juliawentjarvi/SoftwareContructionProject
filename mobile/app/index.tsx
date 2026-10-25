import React, { useEffect, useRef, useState } from "react";
import { AppState, Pressable, ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import LoginScreen from "./login";
import RegisterScreen from "./register";
import MealsScreen from "./meals";
import ActivityScreen from "./activity";
import SudokuScreen from "./sudoku";
import RewardsScreen from "./rewards";
import StreakHeart from "../src/components/StreakHeart";
import Avatar from "../src/components/Avatar";
import { sceneTheme } from "../src/services/themes";
import SettingsScreen from "./settings";
import { Bear } from "../src/components/bear/Bear";
import api, { AuthSession, errorMessage, Profile, ProgressSummary } from "../src/services/api";
import { configureNotifications, enableMealReminders, reminderSupport } from "../src/services/reminders";
import { subscribeToNotificationResponses } from "../src/services/notificationListener";
import { clearAccessToken, saveAccessToken } from "../src/services/sessionVault";
import { setRemindersEnabled } from "../src/services/reminderSettings";
import { goalBarFill, goalBarLabel } from "../src/services/goalBar";
import { energyLabel, stepsLabel } from "../src/services/stepsDisplay";
import { syncTimezone } from "../src/services/timezoneSync";
import { endSession } from "../src/services/session";
import { restoreSession } from "../src/services/restoreSession";

type AppView = "home" | "meals" | "activity" | "sudoku" | "rewards" | "settings";

export default function App() {
	const [session, setSession] = useState<AuthSession | null>(null);
	const [authMode, setAuthMode] = useState<"login" | "register">("login");
	const [view, setView] = useState<AppView>("home");
	const [progress, setProgress] = useState<ProgressSummary | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [fedAt, setFedAt] = useState<number | null>(null);
	const [emoteSignal, setEmoteSignal] = useState(0);
	const [savedOffer, setSavedOffer] = useState(false);
	const [progressVersion, setProgressVersion] = useState(0);
	const [picture, setPicture] = useState<string | null>(null);
	const [heartBeat, setHeartBeat] = useState(0); // bumped when the app is entered so the streak heart beats
	// Whether this device really has the reminders scheduled; the saved preference alone does not mean it does.
	const [deviceReminders, setDeviceReminders] = useState(false);

	// Stay signed in: on launch, resume the stored sign-in if the server still accepts it.
	const [restoring, setRestoring] = useState(true);
	const [unreachable, setUnreachable] = useState<string | null>(null);

	const restore = async () => {
		setRestoring(true);
		setUnreachable(null);
		const result = await restoreSession();
		if (result.status === "signed-in") await authenticate(result.session);
		if (result.status === "unreachable") setUnreachable(result.message);
		setRestoring(false);
	};

	useEffect(() => { void restore(); }, []);

	const sessionRef = useRef<AuthSession | null>(null);
	sessionRef.current = session;

	// The device's timezone is the only timezone setting: follow it whenever the app is used.
	const followDeviceTimezone = async (current: AuthSession) => {
		const result = await syncTimezone(current.accessToken, current.user);
		if (result.changed && sessionRef.current?.accessToken === current.accessToken) {
			setSession({ ...sessionRef.current, user: result.user });
		}
	};

	useEffect(() => {
		const subscription = AppState.addEventListener("change", (state) => {
			if (state === "active" && sessionRef.current) void followDeviceTimezone(sessionRef.current);
		});
		return () => subscription.remove();
	}, []);

	const logOut = async () => {
		await endSession();
		setSession(null);
		setProgress(null);
		setPicture(null);
		setDeviceReminders(false);
		setSavedOffer(false);
		setFedAt(null);
		setError(null);
		setAuthMode("login");
		setView("home");
	};

	const authenticate = async (nextSession: AuthSession) => {
		setSession(nextSession);
		setHeartBeat((n) => n + 1);
		setPicture(null);
		if (nextSession.user.hasProfilePicture) void api.getProfilePicture(nextSession.accessToken).then((result) => { if (result.ok) setPicture(result.body.image); });
		void followDeviceTimezone(nextSession);
		void saveAccessToken(nextSession.accessToken); // lets a reminder's "Log a meal" action save while the app is closed
		setView("home");
		setDeviceReminders(false);
		if (nextSession.user.notificationsEnabled && reminderSupport().supported) {
			const scheduled = await enableMealReminders(nextSession.user.reminderTimes);
			setDeviceReminders(scheduled.ok);
			if (!scheduled.ok) setError(scheduled.message);
		}
	};

	useEffect(() => {
		if (!session || view !== "home") return;
		let active = true;
		void api.getProgress(session.accessToken).then((result) => {
			if (active && result.ok) setProgress(result.body.progress);
		});
		return () => { active = false; };
	}, [session, view, progressVersion]);

	// Set up notification display and actions once on phones, and react to taps and answers on reminders.
	useEffect(() => {
		void configureNotifications().catch(() => undefined);
		return subscribeToNotificationResponses((outcome) => {
			if (outcome.status === "open-meals" || outcome.status === "needs-sign-in") setView("meals");
			if (outcome.status === "logged") { setFedAt(Date.now()); setView("home"); }
		});
	}, []);

	// The "log another meal" offer after a save disappears on its own after seven seconds.
	useEffect(() => {
		if (!savedOffer) return;
		const timer = setTimeout(() => setSavedOffer(false), 7000);
		return () => clearTimeout(timer);
	}, [savedOffer]);

	const toggleReminders = async (enabled: boolean) => {
		if (!session) return;
		const outcome = await setRemindersEnabled(session.accessToken, session.user, enabled);
		if (outcome.ok) {
			setSession({ ...session, user: outcome.user });
			setDeviceReminders(enabled);
			setError(null);
			return;
		}
		if (outcome.user) setSession({ ...session, user: outcome.user });
		if (enabled) setDeviceReminders(false);
		setError(outcome.message);
	};

	const updateProfile = (user: Profile) => {
		if (session) setSession({ ...session, user });
	};

	if (restoring) {
		return <View style={styles.centered}><Text style={styles.centeredTitle}>Bear Care</Text><Text style={styles.centeredText}>Waking up the bear...</Text></View>;
	}

	if (!session && unreachable) {
		return (
			<View style={styles.centered}>
				<Text style={styles.centeredTitle}>Bear Care</Text>
				<Text accessibilityRole="alert" style={styles.centeredText}>{unreachable}</Text>
				<Pressable accessibilityRole="button" style={styles.primaryButton} onPress={() => void restore()}><Text style={styles.primaryButtonText}>Try again</Text></Pressable>
				<Pressable accessibilityRole="button" onPress={() => { void endSession(); setUnreachable(null); }} style={styles.deleteLinkSpacing}><Text style={styles.centeredLink}>Log out instead</Text></Pressable>
			</View>
		);
	}

	if (!session) {
		if (authMode === "register") return <RegisterScreen onAuthenticated={(value) => void authenticate(value)} onSignIn={() => setAuthMode("login")} />;
		return <LoginScreen onAuthenticated={(value) => void authenticate(value)} onCreateAccount={() => setAuthMode("register")} />;
	}

	const mealCount = progress?.mealCount ?? 0;
	const mealGoal = progress?.dailyMealGoal ?? session.user.dailyMealGoal;
	const energy = goalBarFill(mealCount, mealGoal);
	const theme = sceneTheme(session.user.selectedTheme);

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
						<Switch value={session.user.notificationsEnabled && deviceReminders} onValueChange={(enabled) => void toggleReminders(enabled)} accessibilityLabel="Toggle meal reminders" />
					</View>
					<Pressable accessibilityRole="button" accessibilityLabel="Profile and settings" onPress={() => setView("settings")} style={styles.profileButton}><Avatar image={picture} name={session.user.displayName} size={40} /></Pressable>
				</View>
			</View>

			{view === "meals" ? <View style={styles.page}><Pressable onPress={() => setView("home")} style={styles.back}><Text style={styles.backText}>‹  Home</Text></Pressable><MealsScreen token={session.accessToken} timezone={session.user.timezone} onMealSaved={() => { setFedAt(Date.now()); setSavedOffer(true); setView("home"); }} /></View> : null}
			{view === "activity" ? <View style={styles.page}><Pressable onPress={() => setView("home")} style={styles.back}><Text style={styles.backText}>‹  Home</Text></Pressable><ActivityScreen token={session.accessToken} timezone={session.user.timezone} onSaved={() => undefined} /></View> : null}
			{view === "sudoku" ? <View style={styles.page}><Pressable onPress={() => setView("home")} style={styles.back}><Text style={styles.backText}>‹  Home</Text></Pressable><SudokuScreen token={session.accessToken} onChanged={() => setProgressVersion((n) => n + 1)} /></View> : null}
			{view === "rewards" ? <View style={styles.page}><Pressable onPress={() => setView("home")} style={styles.back}><Text style={styles.backText}>‹  Home</Text></Pressable><RewardsScreen token={session.accessToken} user={session.user} onProfileChanged={updateProfile} onTreat={() => { setFedAt(Date.now()); setView("home"); }} /></View> : null}
			{view === "settings" ? <View style={styles.page}><Pressable onPress={() => setView("home")} style={styles.back}><Text style={styles.backText}>‹  Home</Text></Pressable><SettingsScreen session={session} onProfileChanged={updateProfile} deviceReminders={deviceReminders} onDeviceReminders={setDeviceReminders} onLogout={logOut} picture={picture} onPictureChanged={setPicture} onAccountDeleted={() => { void clearAccessToken(); setSession(null); setView("home"); }} /></View> : null}
			{view === "home" ? <ScrollView style={styles.home} contentContainerStyle={styles.homeContent}>
				{savedOffer ? <View accessibilityRole="alert" style={styles.savedOffer}>
					<Text style={styles.savedText}>Meal saved.</Text>
					<Pressable accessibilityRole="button" onPress={() => { setSavedOffer(false); setView("meals"); }}><Text style={styles.savedAction}>Log another meal</Text></Pressable>
				</View> : null}
				<View style={styles.statusRow}>
					<View style={styles.status}>
						<View style={styles.statusHeading}><Text style={styles.statusLabel}>DAILY GOAL</Text><Text style={styles.statusValue}>{goalBarLabel(mealCount, mealGoal)}</Text></View>
						<View style={styles.track}><View style={[styles.fill, styles.energyFill, { width: `${energy}%` }]} /></View>
					</View>
					<View style={styles.status}>
						<View style={styles.statusHeading}><Text style={styles.statusLabel}>CARE STREAK</Text><Text style={styles.statusValue}>{progress?.currentStreakDays ?? 0} days</Text></View>
						<View style={styles.heartRow}><StreakHeart days={progress?.currentStreakDays ?? 0} beatKey={heartBeat} /></View>
					</View>
				</View>

				<View style={styles.statusRow}>
					<View style={styles.status}>
						<View style={styles.statusHeading}><Text style={styles.statusLabel}>ENERGY</Text><Text style={styles.statusValue}>{progress ? energyLabel(progress.energy) : "0/0 energy"}</Text></View>
						<View style={styles.track}><View style={[styles.fill, styles.energyPointsFill, { width: `${progress?.energy.fill ?? 0}%` }]} /></View>
					</View>
					<View style={styles.status}>
						<View style={styles.statusHeading}><Text style={styles.statusLabel}>STEPS</Text></View>
						<Text accessibilityLabel="Steps today" style={styles.stepsText}>{stepsLabel(progress?.steps ?? null, progress?.stepTarget ?? session.user.stepTarget)}</Text>
					</View>
				</View>

				<View style={[styles.scene, { backgroundColor: theme.background, borderColor: theme.border }]}>
					<View style={styles.sceneTop}><Text style={[styles.sceneOverline, { color: theme.mutedText }]}>TODAY'S LITTLE CHECK-IN</Text><Text style={[styles.sceneDate, { color: theme.mutedText }]}>{progress?.date ?? ""}</Text></View>
					<View style={styles.playArea}>
						<Pressable onPress={() => setView("meals")} accessibilityRole="button" style={[styles.sceneObject, styles.bowl]}><Text style={styles.objectIcon}>◡</Text><Text style={styles.objectLabel}>Food bowl</Text></Pressable>
						<View style={styles.bearArea}><Bear height={250} fedAt={fedAt} emoteSignal={emoteSignal} accessory={session.user.selectedAccessory} /><Text style={[styles.bearCaption, { color: theme.mutedText }]}>{progress?.goalMet ? "You did enough today." : progress?.bearHealth === "low" ? "I'm a little low on energy. A small meal and a pause would cheer me up." : "I'm here for your next pause."}</Text></View>
						<Pressable onPress={() => { setEmoteSignal((n) => n + 1); setView("sudoku"); }} accessibilityRole="button" style={[styles.sceneObject, styles.sudoku]}><Text style={styles.sudokuGrid}>□ □ □</Text><Text style={styles.objectLabel}>Sudoku</Text></Pressable>
					</View>
					<View style={[styles.sceneFoot, { borderColor: theme.border }]}><Text style={[styles.footText, { color: theme.text }]}>{progress?.goalMet ? "Today's meal goal is complete." : `${Math.max(0, mealGoal - mealCount)} meal${mealGoal - mealCount === 1 ? "" : "s"} to reach today's goal.`}</Text></View>
				</View>

				<View style={styles.logSection}>
					<View style={styles.logHeading}><View><Text style={styles.sectionKicker}>YOUR ROUTINE</Text><Text style={styles.sectionTitle}>A gentle rhythm</Text></View><Text style={styles.streak}>{progress?.currentStreakDays ?? 0} day streak</Text></View>
					{progress?.lastSevenDays.map((day) => <View key={day.date} style={styles.dayRow}><Text style={styles.dayDate}>{new Date(`${day.date}T12:00:00`).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}</Text><View style={styles.dayTrack}><View style={[styles.dayFill, { width: `${Math.min(100, day.mealCount / mealGoal * 100)}%` }]} /></View><Text style={styles.dayCount}>{day.mealCount}/{mealGoal}</Text></View>)}
				</View>

				<Pressable accessibilityRole="button" style={[styles.primaryButton, styles.shopAction]} onPress={() => setView("rewards")}><Text style={styles.primaryButtonText}>Bear shop</Text><Text style={styles.buttonArrow}>→</Text></Pressable>
				<Pressable accessibilityRole="button" style={[styles.primaryButton, styles.secondaryAction]} onPress={() => setView("activity")}><Text style={styles.primaryButtonText}>Log steps or activity</Text><Text style={styles.buttonArrow}>→</Text></Pressable>
				<Pressable accessibilityRole="button" style={styles.primaryButton} onPress={() => setView("meals")}><Text style={styles.primaryButtonText}>Log a meal</Text><Text style={styles.buttonArrow}>→</Text></Pressable>
				{error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
			</ScrollView> : null}
		</View>
	);
}

const styles = StyleSheet.create({
	centered: { flex: 1, alignItems: "center", justifyContent: "center", padding: 28, gap: 14, backgroundColor: "#eef3ed" },
	centeredTitle: { color: "#1d2923", fontSize: 24, fontWeight: "800" },
	centeredText: { color: "#58665e", fontSize: 15, textAlign: "center", maxWidth: 320 },
	centeredLink: { color: "#315b49", fontSize: 14, textDecorationLine: "underline" },
	deleteLinkSpacing: { paddingVertical: 8 },
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
	energyPointsFill: { backgroundColor: "#d9a441" },
	stepsText: { color: "#1d2923", fontSize: 12, fontWeight: "600" },
	heartRow: { alignItems: "flex-start", paddingTop: 2 },
	shopAction: { backgroundColor: "#d9a441", marginBottom: 10 },
	secondaryAction: { backgroundColor: "#315b49", marginBottom: 10 },
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
