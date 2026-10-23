import React, { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { getApiBaseUrl, testAndSetApiBaseUrl } from "../services/api";

export default function ApiConnectionSettings() {
	const [expanded, setExpanded] = useState(false);
	const [serverUrl, setServerUrl] = useState("");
	const [message, setMessage] = useState<string | null>(null);
	const [isChecking, setIsChecking] = useState(false);

	useEffect(() => {
		void getApiBaseUrl().then(setServerUrl).catch(() => {
			setMessage("Saved connection settings couldn't be loaded. Enter the server URL again.");
		});
	}, []);

	const save = async () => {
		setIsChecking(true);
		setMessage(null);
		const result = await testAndSetApiBaseUrl(serverUrl);
		setMessage(result.ok ? "Connected and saved. The app will use this server for future requests." : result.message);
		if (result.ok) setServerUrl(result.baseUrl);
		setIsChecking(false);
	};

	return (
		<View style={styles.container}>
			<Pressable accessibilityRole="button" onPress={() => setExpanded(!expanded)}>
				<Text style={styles.toggle}>{expanded ? "Hide connection settings" : "Connection settings"}</Text>
			</Pressable>
			{expanded ? <View style={styles.form}>
				<Text style={styles.description}>Use a stable HTTPS server address to connect on different networks. For a private server, use its LAN address only when your device is on that network or VPN.</Text>
				<Text style={styles.label}>API server URL</Text>
				<TextInput
					accessibilityLabel="API server URL"
					autoCapitalize="none"
					autoCorrect={false}
					keyboardType="url"
					onChangeText={setServerUrl}
					placeholder="https://api.example.com"
					style={styles.input}
					value={serverUrl}
				/>
				<Pressable accessibilityRole="button" disabled={isChecking} onPress={() => void save()} style={[styles.button, isChecking && styles.disabled]}>
					{isChecking ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Test and save</Text>}
				</Pressable>
				{message ? <Text accessibilityRole="alert" style={message.startsWith("Connected") ? styles.success : styles.error}>{message}</Text> : null}
			</View> : null}
		</View>
	);
}

const styles = StyleSheet.create({
	container: { marginTop: 18 },
	toggle: { color: "#315b49", fontSize: 14, fontWeight: "700", textAlign: "center", paddingVertical: 8 },
	form: { borderWidth: 1, borderColor: "#dce5dc", borderRadius: 8, padding: 14, backgroundColor: "#fff", marginTop: 6 },
	description: { color: "#58665e", fontSize: 13, lineHeight: 18, marginBottom: 12 },
	label: { color: "#2c3c33", fontSize: 13, fontWeight: "600", marginBottom: 7 },
	input: { minHeight: 46, borderWidth: 1, borderColor: "#cbd6cd", borderRadius: 6, paddingHorizontal: 12, color: "#1d2923", marginBottom: 10, fontSize: 15 },
	button: { minHeight: 44, backgroundColor: "#315b49", borderRadius: 6, justifyContent: "center", alignItems: "center" },
	buttonText: { color: "#fff", fontWeight: "700" },
	disabled: { opacity: 0.7 },
	success: { color: "#315b49", fontSize: 13, marginTop: 10 },
	error: { color: "#a6372d", fontSize: 13, marginTop: 10 },
});
