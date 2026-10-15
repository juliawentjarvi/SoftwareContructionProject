import React, { useState } from "react";
import { View, Text, Button, StyleSheet, ScrollView } from "react-native";
import LoginScreen from "./login";
import RegisterScreen from "./register";
import MealsScreen from "./meals";
import { AuthSession } from "../src/services/api";

export default function App() {
	const [session, setSession] = useState<AuthSession | null>(null);
	const [authMode, setAuthMode] = useState<"login" | "register">("login");
	const [view, setView] = useState<"home" | "meals">("home");

	if (!session) {
		if (authMode === "register") {
			return <RegisterScreen onAuthenticated={setSession} onSignIn={() => setAuthMode("login")} />;
		}
		return <LoginScreen onAuthenticated={setSession} onCreateAccount={() => setAuthMode("register")} />;
	}

	return (
		<View style={styles.app}>
			<View style={styles.header}>
				<View>
					<Text style={styles.appTitle}>Bear Care</Text>
					<Text style={styles.email}>{session.user.email}</Text>
				</View>
				<Button title="Sign out" onPress={() => { setSession(null); setView("home"); }} />
			</View>

			{view === "meals" ? (
				<>
					<Button title="Back" onPress={() => setView("home")} />
					<MealsScreen token={session.token} />
				</>
			) : (
				<ScrollView contentContainerStyle={styles.container}>
					<View style={styles.stats}>
						<Text style={styles.stat}>Energy  [===     ]</Text>
						<Text style={styles.stat}>Health  [====   ]</Text>
					</View>
					<View style={styles.scene}>
						<Text style={styles.bear}>Bear placeholder</Text>
						<View style={styles.sceneItems}>
							<Text style={styles.item}>Food bowl</Text>
							<Text style={styles.item}>Sudoku paper</Text>
						</View>
					</View>
					<Button title="Open meal log" onPress={() => setView("meals")} />
				</ScrollView>
			)}
		</View>
	);
}

const styles = StyleSheet.create({
	app: { flex: 1, paddingTop: 48 },
	container: { padding: 20 },
	header: { paddingHorizontal: 20, paddingBottom: 16, flexDirection: "row", justifyContent: "space-between", alignItems: "center", borderBottomWidth: 1, borderColor: "#e3e8e3" },
	appTitle: { color: "#1d2923", fontSize: 20, fontWeight: "700" },
	email: { color: "#58665e", fontSize: 13, marginTop: 3 },
	stats: { flexDirection: "row", justifyContent: "space-between", gap: 12 },
	stat: { flex: 1, color: "#315b49", backgroundColor: "#eef3ed", padding: 12, borderRadius: 8, fontWeight: "600" },
	scene: { minHeight: 280, marginVertical: 22, backgroundColor: "#f6f4e9", borderRadius: 12, alignItems: "center", justifyContent: "center", padding: 20 },
	bear: { color: "#315b49", fontSize: 24, fontWeight: "700" },
	sceneItems: { width: "100%", flexDirection: "row", justifyContent: "space-between", marginTop: 70 },
	item: { color: "#58665e", backgroundColor: "#ffffff", padding: 12, borderRadius: 8 },
});
