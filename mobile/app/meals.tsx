import React, { useEffect, useState } from "react";
import { View, Text, TextInput, Button, FlatList, StyleSheet } from "react-native";
import api from "../src/services/api";

export default function MealsScreen({ token }: { token?: string }) {
	const [meals, setMeals] = useState<any[]>([]);
	const [name, setName] = useState("");
	const [notes, setNotes] = useState("");

	const load = async () => {
		if (!token) return;
		const res: any = await api.getMeals(token);
		if (res.ok) setMeals(res.body || []);
	};

	useEffect(() => {
		load();
	}, [token]);

	const add = async () => {
		if (!token || !name) return;
		const res: any = await api.createMeal(token, name, notes);
		if (res.ok) {
			setName("");
			setNotes("");
			load();
		}
	};

	return (
		<View style={styles.container}>
			<Text style={styles.title}>Meals</Text>
			<TextInput placeholder="Meal name" style={styles.input} value={name} onChangeText={setName} />
			<TextInput placeholder="Notes" style={styles.input} value={notes} onChangeText={setNotes} />
			<Button title="Add meal" onPress={add} />

			<FlatList data={meals} keyExtractor={(i) => i._id} renderItem={({ item }) => (
				<View style={styles.item}>
					<Text style={styles.itemTitle}>{item.name}</Text>
					<Text style={styles.itemSub}>{new Date(item.eatenAt).toLocaleString()}</Text>
					{item.notes ? <Text>{item.notes}</Text> : null}
				</View>
			)} />
		</View>
	);
}

const styles = StyleSheet.create({
	container: { padding: 16 },
	title: { fontSize: 20, marginBottom: 12 },
	input: { borderWidth: 1, borderColor: "#ccc", padding: 8, marginBottom: 8 },
	item: { padding: 8, borderBottomWidth: 1, borderColor: "#eee" },
	itemTitle: { fontWeight: "600" },
	itemSub: { color: "#666", fontSize: 12 },
});
