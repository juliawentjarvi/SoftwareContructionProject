import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import api, { errorMessage, MealEntry } from "../src/services/api";
import { formatMealTime, localPartsInZone, zonedTimeToIso } from "../src/services/time";

const mealTypes: MealEntry["mealType"][] = ["breakfast", "lunch", "dinner", "snack"];

const pad = (n: number) => String(n).padStart(2, "0");

export default function MealsScreen({ token, timezone, onMealSaved }: { token: string; timezone: string; onMealSaved?: () => void }) {
	const [meals, setMeals] = useState<MealEntry[]>([]);
	const [name, setName] = useState("");
	const [notes, setNotes] = useState("");
	const [mealType, setMealType] = useState<MealEntry["mealType"]>("breakfast");
	const now = () => localPartsInZone(new Date(), timezone);
	const [date, setDate] = useState(() => now().date);
	const [hour, setHour] = useState(() => pad(now().hour));
	const [minute, setMinute] = useState(() => pad(now().minute));
	const [error, setError] = useState<string | null>(null);
	const [isLoading, setIsLoading] = useState(true);
	const [isSaving, setIsSaving] = useState(false);

	const load = useCallback(async () => {
		setIsLoading(true);
		const result = await api.getMeals(token);
		if (result.ok) {
			setMeals(result.body.meals);
			setError(null);
		} else {
			setError(errorMessage(result.body, "Your meal log couldn't be loaded."));
		}
		setIsLoading(false);
	}, [token]);

	useEffect(() => { void load(); }, [load]);

	const add = async () => {
		if (!name.trim()) {
			setError("Add a name for this meal.");
			return;
		}
		const eatenAt = /^\d{1,2}$/.test(hour) && /^\d{1,2}$/.test(minute) ? zonedTimeToIso(date, Number(hour), Number(minute), timezone) : null;
		if (!eatenAt) {
			setError("Enter a real date (YYYY-MM-DD), an hour from 0 to 23 and a minute from 0 to 59.");
			return;
		}
		setIsSaving(true);
		const result = await api.createMeal(token, name.trim(), mealType, notes.trim() || undefined, eatenAt);
		if (result.ok) {
			setName("");
			setNotes("");
			const current = now();
			setDate(current.date);
			setHour(pad(current.hour));
			setMinute(pad(current.minute));
			setError(null);
			await load();
			onMealSaved?.();
		} else {
			setError(errorMessage(result.body, "This meal couldn't be saved. Check the date and try again."));
		}
		setIsSaving(false);
	};

	const remove = async (mealId: string) => {
		const result = await api.deleteMeal(token, mealId);
		if (result.ok) await load();
		else setError(errorMessage(result.body, "This meal couldn't be deleted."));
	};

	return (
		<View style={styles.container}>
			<Text style={styles.kicker}>YOUR FOOD JOURNAL</Text>
			<Text style={styles.title}>Meal log</Text>
			<Text style={styles.subtitle}>Log a meal now or enter one you had earlier.</Text>
			<View style={styles.form}>
				<TextInput accessibilityLabel="Meal name" placeholder="What did you eat?" style={styles.input} value={name} onChangeText={setName} maxLength={100} />
				<View style={styles.types}>
					{mealTypes.map((type) => <Pressable key={type} onPress={() => setMealType(type)} style={[styles.type, mealType === type && styles.typeSelected]}><Text style={[styles.typeText, mealType === type && styles.typeTextSelected]}>{type}</Text></Pressable>)}
				</View>
				<Text style={styles.label}>When ({timezone})</Text>
				<View style={styles.whenRow}>
					<View style={styles.whenDate}><Text style={styles.fieldLabel}>Date (YYYY-MM-DD)</Text><TextInput accessibilityLabel="Meal date" style={styles.input} value={date} onChangeText={setDate} autoCapitalize="none" maxLength={10} /></View>
					<View style={styles.whenTime}><Text style={styles.fieldLabel}>Hour (0-23)</Text><TextInput accessibilityLabel="Meal hour" style={styles.input} value={hour} onChangeText={setHour} keyboardType="number-pad" maxLength={2} /></View>
					<View style={styles.whenTime}><Text style={styles.fieldLabel}>Minute (0-59)</Text><TextInput accessibilityLabel="Meal minute" style={styles.input} value={minute} onChangeText={setMinute} keyboardType="number-pad" maxLength={2} /></View>
				</View>
				<TextInput accessibilityLabel="Meal notes" placeholder="Notes (optional)" style={[styles.input, styles.notes]} value={notes} onChangeText={setNotes} multiline maxLength={280} />
				<Pressable accessibilityRole="button" onPress={add} disabled={isSaving} style={[styles.submit, isSaving && styles.disabled]}>
					{isSaving ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitText}>Save meal</Text>}
				</Pressable>
			</View>
			{error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
			<Text style={styles.sectionTitle}>Recent meals</Text>
			{isLoading ? <ActivityIndicator color="#315b49" /> : <FlatList data={meals} keyExtractor={(meal) => meal._id} ListEmptyComponent={<Text style={styles.empty}>Your entries will appear here.</Text>} renderItem={({ item }) => (
				<View style={styles.entry}>
					<View style={styles.entryBody}>
						<Text style={styles.entryName}>{item.name}</Text>
						<Text style={styles.entryMeta}>{item.mealType}  ·  {formatMealTime(item.eatenAt, timezone)}</Text>
						{item.notes ? <Text style={styles.entryNotes}>{item.notes}</Text> : null}
					</View>
					<Pressable accessibilityRole="button" accessibilityLabel={`Delete ${item.name}`} onPress={() => void remove(item._id)}><Text style={styles.delete}>Delete</Text></Pressable>
				</View>
			)} />}
		</View>
	);
}

const styles = StyleSheet.create({
	container: { flex: 1, padding: 20, backgroundColor: "#f8f7f0" },
	kicker: { color: "#a34b36", fontSize: 11, fontWeight: "800", letterSpacing: 1.5 },
	title: { color: "#1d2923", fontSize: 28, fontWeight: "700", marginTop: 5 },
	subtitle: { color: "#58665e", fontSize: 14, marginTop: 5, marginBottom: 18 },
	form: { padding: 16, backgroundColor: "#fff", borderColor: "#dce5dc", borderWidth: 1, borderRadius: 8 },
	label: { color: "#58665e", fontSize: 12, marginBottom: 6 },
	fieldLabel: { color: "#58665e", fontSize: 11, marginBottom: 4 },
	whenRow: { flexDirection: "row", gap: 8 },
	whenDate: { flex: 2 },
	whenTime: { flex: 1 },
	input: { minHeight: 46, borderWidth: 1, borderColor: "#cbd6cd", borderRadius: 6, paddingHorizontal: 12, color: "#1d2923", marginBottom: 10, fontSize: 15 },
	notes: { minHeight: 74, paddingTop: 10, textAlignVertical: "top" },
	types: { flexDirection: "row", gap: 6, marginBottom: 12, flexWrap: "wrap" },
	type: { paddingHorizontal: 10, paddingVertical: 8, borderWidth: 1, borderColor: "#cbd6cd", borderRadius: 6 },
	typeSelected: { backgroundColor: "#315b49", borderColor: "#315b49" },
	typeText: { color: "#315b49", textTransform: "capitalize", fontSize: 12, fontWeight: "600" },
	typeTextSelected: { color: "#fff" },
	submit: { minHeight: 46, backgroundColor: "#c5523e", borderRadius: 6, alignItems: "center", justifyContent: "center" },
	disabled: { opacity: 0.7 },
	submitText: { color: "#fff", fontWeight: "700", fontSize: 15 },
	error: { color: "#a6372d", marginTop: 10 },
	sectionTitle: { color: "#1d2923", fontSize: 18, fontWeight: "700", marginTop: 22, marginBottom: 8 },
	empty: { color: "#58665e", paddingVertical: 18 },
	entry: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10, paddingVertical: 12, borderBottomWidth: 1, borderColor: "#e3e8e3" },
	entryBody: { flex: 1 },
	entryName: { color: "#1d2923", fontWeight: "700", fontSize: 15 },
	entryMeta: { color: "#58665e", fontSize: 12, marginTop: 3, textTransform: "capitalize" },
	entryNotes: { color: "#58665e", fontSize: 13, marginTop: 4 },
	delete: { color: "#a6372d", fontSize: 13, fontWeight: "600", padding: 8 },
});
