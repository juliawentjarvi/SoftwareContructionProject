import React, { useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from "react-native";
import api, { AuthSession, errorMessage, Profile } from "../src/services/api";
import { isTimeZone } from "../src/services/time";
import { clearMealReminders, remindersAvailable, requestReminderPermission, scheduleMealReminders } from "../src/services/reminders";
import ApiConnectionSettings from "../src/components/ApiConnectionSettings";

interface SettingsScreenProps {
	session: AuthSession;
	onProfileChanged: (profile: Profile) => void;
	onAccountDeleted: () => void;
}

export default function SettingsScreen({ session, onProfileChanged, onAccountDeleted }: SettingsScreenProps) {
	const canScheduleReminders = remindersAvailable();
	const [profile, setProfile] = useState(session.user);
	const [times, setTimes] = useState(session.user.reminderTimes.slice(0, 3));
	const [error, setError] = useState<string | null>(null);
	const [isSaving, setIsSaving] = useState(false);

	const save = async (changes: Partial<Pick<Profile, "displayName" | "timezone" | "dailyMealGoal" | "notificationsEnabled" | "reminderTimes">>) => {
		setIsSaving(true);
		setError(null);
		const result = await api.updateProfile(session.accessToken, changes);
		if (!result.ok) {
			setError(errorMessage(result.body, "Settings couldn't be saved."));
			setIsSaving(false);
			return null;
		}
		setProfile(result.body.user);
		onProfileChanged(result.body.user);
		setIsSaving(false);
		return result.body.user;
	};

	const toggleReminders = async (enabled: boolean) => {
		if (enabled) {
			const permitted = await requestReminderPermission();
			if (!permitted) {
				setError("Allow notifications in your device settings to turn reminders on.");
				return;
			}
			const updated = await save({ notificationsEnabled: true, reminderTimes: times });
			if (updated) await scheduleMealReminders(updated.reminderTimes);
		} else {
			const updated = await save({ notificationsEnabled: false });
			if (updated) await clearMealReminders();
		}
	};

	const updateReminderTimes = async () => {
		if (times.length !== 3 || times.some((time) => !/^([01]\d|2[0-3]):[0-5]\d$/.test(time))) {
			setError("Enter three times in 24-hour format, such as 09:00.");
			return;
		}
		const updated = await save({ reminderTimes: times });
		if (updated?.notificationsEnabled) await scheduleMealReminders(updated.reminderTimes);
	};

	const [confirmingDelete, setConfirmingDelete] = useState(false);
	const [timezone, setTimezone] = useState(session.user.timezone);

	const saveTimezone = async () => {
		const value = timezone.trim();
		if (!isTimeZone(value)) {
			setError("Use a valid timezone name, such as Europe/Stockholm.");
			return;
		}
		const updated = await save({ timezone: value });
		if (updated) setTimezone(updated.timezone);
	};

	const deleteAccount = async () => {
		setIsSaving(true);
		const result = await api.deleteAccount(session.accessToken);
		setIsSaving(false);
		if (result.ok) {
			await clearMealReminders();
			onAccountDeleted();
		} else {
			setConfirmingDelete(false);
			setError(errorMessage(result.body, "The account couldn't be deleted."));
		}
	};

	return (
		<ScrollView style={styles.screen} contentContainerStyle={styles.content}>
			<Text style={styles.kicker}>YOUR ACCOUNT</Text>
			<Text style={styles.title}>Profile & settings</Text>
			<Text style={styles.email}>{profile.email}</Text>

			<View style={styles.section}>
				<Text style={styles.sectionTitle}>Server connection</Text>
				<ApiConnectionSettings />
			</View>

			<View style={styles.section}>
				<Text style={styles.sectionTitle}>Profile</Text>
				<Text style={styles.label}>Display name</Text>
				<TextInput accessibilityLabel="Display name" style={styles.input} value={profile.displayName} onChangeText={(displayName) => setProfile({ ...profile, displayName })} onBlur={() => void save({ displayName: profile.displayName })} maxLength={60} />
				<Text style={styles.label}>Timezone (meal times are shown in this zone)</Text>
				<TextInput accessibilityLabel="Timezone" style={styles.input} value={timezone} onChangeText={setTimezone} onBlur={() => void saveTimezone()} autoCapitalize="none" autoCorrect={false} placeholder="Europe/Stockholm" maxLength={100} />
				<Text style={styles.label}>Meals you aim for each day</Text>
				<View style={styles.goalRow}>
					{[1, 2, 3, 4, 5, 6, 7, 8].map((goal) => <Pressable key={goal} onPress={() => void save({ dailyMealGoal: goal })} style={[styles.goal, profile.dailyMealGoal === goal && styles.goalSelected]}><Text style={[styles.goalText, profile.dailyMealGoal === goal && styles.goalTextSelected]}>{goal}</Text></Pressable>)}
				</View>
			</View>

			<View style={styles.section}>
				<View style={styles.settingRow}>
					<View style={styles.settingCopy}>
						<Text style={styles.sectionTitle}>Meal reminders</Text>
						<Text style={styles.description}>{canScheduleReminders ? "Daily device notifications at times you choose." : "Reminders need a development build; sign-in and meal logging work in Expo Go."}</Text>
					</View>
					<Switch value={profile.notificationsEnabled} onValueChange={(enabled) => void toggleReminders(enabled)} accessibilityLabel="Meal reminders" disabled={!canScheduleReminders} />
				</View>
				{profile.notificationsEnabled && times.map((time, index) => <View key={index} style={styles.timeRow}>
					<Text style={styles.label}>Reminder {index + 1}</Text>
					<TextInput accessibilityLabel={`Reminder ${index + 1} time`} style={[styles.input, styles.timeInput]} value={time} onChangeText={(value) => setTimes(times.map((entry, entryIndex) => entryIndex === index ? value : entry))} placeholder="09:00" keyboardType="numbers-and-punctuation" maxLength={5} />
				</View>)}
				{profile.notificationsEnabled ? <Pressable style={styles.secondaryButton} onPress={() => void updateReminderTimes()} disabled={isSaving}><Text style={styles.secondaryButtonText}>{isSaving ? "Saving..." : "Save reminder times"}</Text></Pressable> : null}
				<Text style={styles.footnote}>Your device controls whether reminders appear during Do Not Disturb or Focus modes.</Text>
			</View>

			{error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
			{isSaving ? <ActivityIndicator color="#315b49" /> : null}
			<View style={styles.dangerSection}>
				<Text style={styles.sectionTitle}>Account</Text>
				{confirmingDelete ? <View accessibilityRole="alert">
					<Text style={styles.description}>Delete this account? Your profile and meal log will be permanently deleted. This cannot be undone.</Text>
					<View style={styles.confirmRow}>
						<Pressable accessibilityRole="button" onPress={() => setConfirmingDelete(false)} disabled={isSaving} style={styles.secondaryButton}><Text style={styles.secondaryButtonText}>Keep my account</Text></Pressable>
						<Pressable accessibilityRole="button" accessibilityLabel="Confirm account deletion" onPress={() => void deleteAccount()} disabled={isSaving} style={styles.deleteButton}><Text style={styles.deleteText}>Yes, delete everything</Text></Pressable>
					</View>
				</View> : <Pressable accessibilityRole="button" accessibilityLabel="Delete account" onPress={() => setConfirmingDelete(true)} style={styles.deleteLink}><Text style={styles.deleteLinkText}>Delete account</Text></Pressable>}
			</View>
		</ScrollView>
	);
}

const styles = StyleSheet.create({
	screen: { flex: 1, backgroundColor: "#f8f7f0" },
	content: { padding: 20, paddingBottom: 40 },
	kicker: { color: "#a34b36", fontSize: 11, fontWeight: "800", letterSpacing: 1.5 },
	title: { color: "#1d2923", fontSize: 28, fontWeight: "700", marginTop: 5 },
	email: { color: "#58665e", marginTop: 5, marginBottom: 20 },
	section: { borderTopWidth: 1, borderColor: "#dce5dc", paddingTop: 18, paddingBottom: 18 },
	sectionTitle: { color: "#1d2923", fontSize: 17, fontWeight: "700", marginBottom: 12 },
	label: { color: "#58665e", fontSize: 12, marginBottom: 6 },
	input: { minHeight: 46, borderWidth: 1, borderColor: "#cbd6cd", borderRadius: 6, paddingHorizontal: 12, color: "#1d2923", marginBottom: 14, fontSize: 15, backgroundColor: "#fff" },
	goalRow: { flexDirection: "row", flexWrap: "wrap", gap: 7 },
	goal: { width: 38, height: 38, borderWidth: 1, borderColor: "#cbd6cd", borderRadius: 6, alignItems: "center", justifyContent: "center", backgroundColor: "#fff" },
	goalSelected: { backgroundColor: "#315b49", borderColor: "#315b49" },
	goalText: { color: "#315b49", fontWeight: "700" },
	goalTextSelected: { color: "#fff" },
	settingRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 10 },
	settingCopy: { flex: 1 },
	description: { color: "#58665e", fontSize: 13, marginTop: -6, marginBottom: 12 },
	timeRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 12 },
	timeInput: { width: 100, textAlign: "center", marginBottom: 8 },
	secondaryButton: { minHeight: 42, borderWidth: 1, borderColor: "#315b49", borderRadius: 6, justifyContent: "center", alignItems: "center", marginTop: 8 },
	secondaryButtonText: { color: "#315b49", fontWeight: "700" },
	footnote: { color: "#7b8780", fontSize: 12, marginTop: 12, lineHeight: 17 },
	error: { color: "#a6372d", marginVertical: 12 },
	dangerSection: { borderTopWidth: 1, borderColor: "#dce5dc", paddingTop: 18 },
	confirmRow: { flexDirection: "row", gap: 10, marginTop: 12, flexWrap: "wrap" },
	deleteLink: { alignSelf: "flex-start", paddingVertical: 8 },
	deleteLinkText: { color: "#a6372d", fontSize: 12, textDecorationLine: "underline" },
	deleteButton: { paddingHorizontal: 14, minHeight: 46, borderWidth: 1, borderColor: "#a6372d", borderRadius: 6, justifyContent: "center", alignItems: "center" },
	deleteText: { color: "#a6372d", fontWeight: "700" },
});