import React, { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from "react-native";
import api, { AuthSession, errorMessage, Profile } from "../src/services/api";
import { getAnimate, setAnimate } from "../src/services/bearPrefs";
import { ANIMATE_DESCRIPTION } from "../src/services/copy";
import { DEVICE_CONTROLS_NOTE, disableMealReminders, reminderSupport } from "../src/services/reminders";
import { checkReminderTimes, saveReminderTimes, setRemindersEnabled } from "../src/services/reminderSettings";
import ApiConnectionSettings from "../src/components/ApiConnectionSettings";
import Avatar from "../src/components/Avatar";
import { pickProfilePicture } from "../src/services/profilePicture";

interface SettingsScreenProps {
	session: AuthSession;
	onProfileChanged: (profile: Profile) => void;
	/** True when this device has the reminders scheduled (not just saved on the account). */
	deviceReminders: boolean;
	onDeviceReminders: (scheduled: boolean) => void;
	onAccountDeleted: () => void;
	onLogout: () => Promise<void>;
	picture: string | null;
	onPictureChanged: (image: string | null) => void;
}

export default function SettingsScreen({ session, onProfileChanged, deviceReminders, onDeviceReminders, onAccountDeleted, onLogout, picture, onPictureChanged }: SettingsScreenProps) {
	const support = reminderSupport();
	const [profile, setProfile] = useState(session.user);
	const [times, setTimes] = useState(session.user.reminderTimes);
	const [error, setError] = useState<string | null>(null);
	const [isSaving, setIsSaving] = useState(false);

	const save = async (changes: Partial<Pick<Profile, "displayName" | "dailyMealGoal" | "stepTarget" | "notificationsEnabled" | "reminderTimes">>) => {
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
		setIsSaving(true);
		setError(null);
		const outcome = await setRemindersEnabled(session.accessToken, profile, enabled);
		setIsSaving(false);
		if (outcome.ok) {
			setProfile(outcome.user);
			onProfileChanged(outcome.user);
			onDeviceReminders(enabled);
			return;
		}
		if (outcome.user) { setProfile(outcome.user); onProfileChanged(outcome.user); }
		if (enabled) onDeviceReminders(false);
		setError(outcome.message);
	};

	const updateReminderTimes = async () => {
		const checked = checkReminderTimes(times);
		if (!checked.ok) {
			setError(checked.message);
			return;
		}
		setIsSaving(true);
		setError(null);
		const outcome = await saveReminderTimes(session.accessToken, profile, checked.times);
		setIsSaving(false);
		if (outcome.ok) {
			setProfile(outcome.user);
			onProfileChanged(outcome.user);
			setTimes(outcome.user.reminderTimes);
			return;
		}
		if (outcome.user) { setProfile(outcome.user); onProfileChanged(outcome.user); setTimes(outcome.user.reminderTimes); onDeviceReminders(false); }
		setError(outcome.message);
	};

	const [goalText, setGoalText] = useState(String(session.user.dailyMealGoal));

	const saveGoal = async () => {
		const value = Number(goalText);
		if (!/^\d+$/.test(goalText.trim()) || !Number.isSafeInteger(value) || value < 1) {
			setError("Enter a whole number of meals per day, 1 or more.");
			setGoalText(String(profile.dailyMealGoal));
			return;
		}
		if (value === profile.dailyMealGoal) return;
		const updated = await save({ dailyMealGoal: value });
		setGoalText(String(updated?.dailyMealGoal ?? profile.dailyMealGoal));
		if (updated) setTimes(updated.reminderTimes); // one reminder per planned meal: the server adds or removes blocks
	};

	const [stepText, setStepText] = useState(session.user.stepTarget === null ? "" : String(session.user.stepTarget));

	// Empty clears the target (steps are then never reported as a met goal).
	const saveStepTarget = async () => {
		const text = stepText.trim();
		const value = text === "" ? null : Number(text);
		if (value !== null && (!/^\d+$/.test(text) || !Number.isSafeInteger(value) || value < 1 || value > 1_000_000)) {
			setError("Enter a whole number of steps, or leave it empty for no step target.");
			setStepText(profile.stepTarget === null ? "" : String(profile.stepTarget));
			return;
		}
		if (value === profile.stepTarget) return;
		const updated = await save({ stepTarget: value });
		if (updated) setStepText(updated.stepTarget === null ? "" : String(updated.stepTarget));
	};

	const [confirmingDelete, setConfirmingDelete] = useState(false);
	const [animate, setAnimateState] = useState(true);
	useEffect(() => { void getAnimate().then(setAnimateState); }, []);
	const [loggingOut, setLoggingOut] = useState(false);

	const choosePicture = async () => {
		setError(null);
		const picked = await pickProfilePicture();
		if (!picked.ok) { if (picked.reason !== "cancelled") setError(picked.message); return; }
		setIsSaving(true);
		const result = await api.setProfilePicture(session.accessToken, picked.dataUrl);
		setIsSaving(false);
		if (!result.ok) { setError(errorMessage(result.body, "The picture couldn't be saved. Try again.")); return; }
		onPictureChanged(picked.dataUrl);
		setProfile(result.body.user);
		onProfileChanged(result.body.user);
	};

	const removePicture = async () => {
		setIsSaving(true);
		const result = await api.removeProfilePicture(session.accessToken);
		setIsSaving(false);
		if (!result.ok) { setError(errorMessage(result.body, "The picture couldn't be removed. Try again.")); return; }
		onPictureChanged(null);
		const next = { ...profile, hasProfilePicture: false };
		setProfile(next);
		onProfileChanged(next);
	};

	const logOut = async () => {
		setLoggingOut(true);
		await onLogout();
	};

	const deleteAccount = async () => {
		setIsSaving(true);
		const result = await api.deleteAccount(session.accessToken);
		setIsSaving(false);
		if (result.ok) {
			await disableMealReminders();
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

			<View style={styles.logoutBox}>
				<Pressable accessibilityRole="button" accessibilityLabel="Log out" onPress={() => void logOut()} disabled={loggingOut} style={[styles.logoutButton, loggingOut && styles.disabled]}>
					{loggingOut ? <ActivityIndicator color="#fff" /> : <Text style={styles.logoutText}>Log out</Text>}
				</Pressable>
				<Text style={styles.logoutHint}>Signs you out on this device. Your meals and settings stay saved on your account.</Text>
			</View>

			<View style={styles.section}>
				<Text style={styles.sectionTitle}>Server connection</Text>
				<ApiConnectionSettings />
			</View>

			<View style={styles.section}>
				<Text style={styles.sectionTitle}>Profile</Text>
				<View style={styles.pictureRow}>
					<Avatar image={picture} name={profile.displayName} size={72} />
					<View style={styles.pictureButtons}>
						<Pressable accessibilityRole="button" accessibilityLabel="Choose profile picture" onPress={() => void choosePicture()} disabled={isSaving} style={styles.secondaryButton}><Text style={styles.secondaryButtonText}>{picture ? "Change picture" : "Choose a picture"}</Text></Pressable>
						{picture ? <Pressable accessibilityRole="button" accessibilityLabel="Remove profile picture" onPress={() => void removePicture()} disabled={isSaving} style={styles.deleteLink}><Text style={styles.deleteLinkText}>Remove picture</Text></Pressable> : null}
					</View>
				</View>
				<Text style={styles.label}>Display name</Text>
				<TextInput accessibilityLabel="Display name" style={styles.input} value={profile.displayName} onChangeText={(displayName) => setProfile({ ...profile, displayName })} onBlur={() => void save({ displayName: profile.displayName })} maxLength={60} />
				<Text style={styles.label}>Meals you aim for each day</Text>
				<TextInput accessibilityLabel="Meals per day" style={[styles.input, styles.goalInput]} value={goalText} onChangeText={setGoalText} onBlur={() => void saveGoal()} onSubmitEditing={() => void saveGoal()} keyboardType="number-pad" maxLength={3} />
				<Text style={styles.label}>Daily step target (optional)</Text>
				<TextInput accessibilityLabel="Step target" placeholder="For example 8000" style={[styles.input, styles.goalInput]} value={stepText} onChangeText={setStepText} onBlur={() => void saveStepTarget()} onSubmitEditing={() => void saveStepTarget()} keyboardType="number-pad" maxLength={7} />
			</View>

			<View style={styles.section}>
				<View style={styles.settingRow}>
					<View style={styles.settingCopy}>
						<Text style={styles.sectionTitle}>Animate the bear</Text>
						<Text style={styles.description}>{ANIMATE_DESCRIPTION}</Text>
					</View>
					<Switch value={animate} onValueChange={(value) => { setAnimateState(value); void setAnimate(value); }} accessibilityLabel="Animate the bear" />
				</View>
			</View>

			<View style={styles.section}>
				<View style={styles.settingRow}>
					<View style={styles.settingCopy}>
						<Text style={styles.sectionTitle}>Meal reminders</Text>
						<Text style={styles.description}>{support.supported ? "Daily notifications on this device at the times you choose." : support.message}</Text>
						{support.supported && profile.notificationsEnabled && !deviceReminders ? <Text style={styles.description}>Reminders are saved for your account but are not scheduled on this device yet. Turn them off and on again to schedule them.</Text> : null}
					</View>
					<Switch value={profile.notificationsEnabled && deviceReminders} onValueChange={(enabled) => void toggleReminders(enabled)} accessibilityLabel="Meal reminders" disabled={isSaving} />
				</View>
				<Text style={styles.label}>Reminder times: one for each of your {profile.dailyMealGoal} planned meal{profile.dailyMealGoal === 1 ? "" : "s"}{profile.dailyMealGoal > times.length ? ` (showing ${times.length}, the most we schedule)` : ""}</Text>
				{times.map((time, index) => <View key={index} style={styles.timeRow}>
					<Text style={styles.timeLabel}>Meal {index + 1}</Text>
					<TextInput accessibilityLabel={`Reminder ${index + 1} time`} style={[styles.input, styles.timeInput]} value={time} onChangeText={(value) => setTimes(times.map((entry, entryIndex) => entryIndex === index ? value : entry))} placeholder="09:00" keyboardType="numbers-and-punctuation" maxLength={5} />
				</View>)}
				<View style={styles.timeActions}>
					<Pressable accessibilityRole="button" style={styles.secondaryButton} onPress={() => void updateReminderTimes()} disabled={isSaving}><Text style={styles.secondaryButtonText}>{isSaving ? "Saving..." : "Save reminder times"}</Text></Pressable>
				</View>
				<Text style={styles.footnote}>{DEVICE_CONTROLS_NOTE}</Text>
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
	pictureRow: { flexDirection: "row", alignItems: "center", gap: 16, marginBottom: 16 },
	pictureButtons: { flex: 1, alignItems: "flex-start" },
	logoutBox: { marginBottom: 18 },
	logoutButton: { minHeight: 52, backgroundColor: "#315b49", borderRadius: 8, alignItems: "center", justifyContent: "center" },
	logoutText: { color: "#fff", fontSize: 17, fontWeight: "800" },
	logoutHint: { color: "#58665e", fontSize: 12, marginTop: 8 },
	timeLabel: { color: "#58665e", fontSize: 13 },
	disabled: { opacity: 0.7 },
	screen: { flex: 1, backgroundColor: "#f8f7f0" },
	content: { padding: 20, paddingBottom: 40 },
	kicker: { color: "#a34b36", fontSize: 11, fontWeight: "800", letterSpacing: 1.5 },
	title: { color: "#1d2923", fontSize: 28, fontWeight: "700", marginTop: 5 },
	email: { color: "#58665e", marginTop: 5, marginBottom: 20 },
	section: { borderTopWidth: 1, borderColor: "#dce5dc", paddingTop: 18, paddingBottom: 18 },
	sectionTitle: { color: "#1d2923", fontSize: 17, fontWeight: "700", marginBottom: 12 },
	label: { color: "#58665e", fontSize: 12, marginBottom: 6 },
	input: { minHeight: 46, borderWidth: 1, borderColor: "#cbd6cd", borderRadius: 6, paddingHorizontal: 12, color: "#1d2923", marginBottom: 14, fontSize: 15, backgroundColor: "#fff" },
	removeText: { color: "#a6372d", fontSize: 13, paddingHorizontal: 10, paddingVertical: 8 },
	timeActions: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
	goalInput: { width: 90 },
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