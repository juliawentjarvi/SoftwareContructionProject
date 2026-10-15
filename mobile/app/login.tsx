import React, { useState } from "react";
import {
	ActivityIndicator,
	KeyboardAvoidingView,
	Platform,
	Pressable,
	ScrollView,
	StyleSheet,
	Text,
	TextInput,
	View,
} from "react-native";
import api, { AuthSession } from "../src/services/api";

interface LoginScreenProps {
	onAuthenticated: (session: AuthSession) => void;
	onCreateAccount: () => void;
}

export default function LoginScreen({ onAuthenticated, onCreateAccount }: LoginScreenProps) {
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [isSubmitting, setIsSubmitting] = useState(false);

	const handleLogin = async () => {
		setError(null);
		if (!email.trim() || !password) {
			setError("Enter your email and password.");
			return;
		}

		setIsSubmitting(true);
		try {
			const result = await api.login(email.trim(), password);
			if (!result.ok) {
				setError(result.body.message || "Those details didn't work. Check them and try again.");
				return;
			}
			onAuthenticated(result.body);
		} finally {
			setIsSubmitting(false);
		}
	};

	return (
		<KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === "ios" ? "padding" : undefined}>
			<ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
				<View style={styles.brand}>
					<View style={styles.brandMark}><Text style={styles.brandMarkText}>B</Text></View>
					<Text style={styles.brandName}>BEAR CARE</Text>
				</View>
				<Text style={styles.title}>Welcome back</Text>
				<Text style={styles.subtitle}>Sign in to check in with your bear.</Text>

				<View style={styles.form}>
					<Text style={styles.label}>Email</Text>
					<TextInput
						style={styles.input}
						value={email}
						onChangeText={setEmail}
						placeholder="you@example.com"
						placeholderTextColor="#7b8780"
						keyboardType="email-address"
						autoCapitalize="none"
						autoCorrect={false}
						autoComplete="email"
						textContentType="emailAddress"
						accessibilityLabel="Email address"
					/>
					<Text style={styles.label}>Password</Text>
					<TextInput
						style={styles.input}
						value={password}
						onChangeText={setPassword}
						placeholder="Your password"
						placeholderTextColor="#7b8780"
						secureTextEntry
						autoComplete="current-password"
						textContentType="password"
						accessibilityLabel="Password"
						onSubmitEditing={handleLogin}
					/>
					{error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
					<Pressable
						style={({ pressed }) => [styles.submit, pressed && !isSubmitting && styles.submitPressed, isSubmitting && styles.submitDisabled]}
					onPress={handleLogin}
					disabled={isSubmitting}
					accessibilityRole="button"
				>
						{isSubmitting ? <ActivityIndicator color="#ffffff" /> : <Text style={styles.submitText}>Sign in</Text>}
					</Pressable>
				</View>

				<View style={styles.switchRow}>
					<Text style={styles.switchText}>New to Bear Care?</Text>
					<Pressable onPress={onCreateAccount} accessibilityRole="button">
						<Text style={styles.switchAction}>Create account</Text>
					</Pressable>
				</View>
			</ScrollView>
		</KeyboardAvoidingView>
	);
}

const styles = StyleSheet.create({
	screen: { flex: 1, backgroundColor: "#eef3ed" },
	content: { flexGrow: 1, justifyContent: "center", paddingHorizontal: 24, paddingVertical: 36 },
	brand: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 32 },
	brandMark: { width: 38, height: 38, borderRadius: 19, backgroundColor: "#315b49", alignItems: "center", justifyContent: "center" },
	brandMarkText: { color: "#ffffff", fontSize: 19, fontWeight: "700" },
	brandName: { color: "#315b49", fontSize: 13, fontWeight: "800", letterSpacing: 1.2 },
	title: { color: "#1d2923", fontSize: 30, fontWeight: "700", marginBottom: 7 },
	subtitle: { color: "#58665e", fontSize: 15, marginBottom: 24 },
	form: { backgroundColor: "#ffffff", borderRadius: 12, padding: 20, borderWidth: 1, borderColor: "#dce5dc" },
	label: { color: "#2c3c33", fontSize: 13, fontWeight: "600", marginBottom: 7, marginTop: 4 },
	input: { minHeight: 48, borderWidth: 1, borderColor: "#cbd6cd", borderRadius: 7, paddingHorizontal: 12, color: "#1d2923", marginBottom: 15, fontSize: 16 },
	error: { color: "#a6372d", fontSize: 14, marginBottom: 12 },
	submit: { minHeight: 50, backgroundColor: "#c5523e", borderRadius: 7, alignItems: "center", justifyContent: "center", marginTop: 4 },
	submitPressed: { backgroundColor: "#a94132" },
	submitDisabled: { opacity: 0.7 },
	submitText: { color: "#ffffff", fontSize: 16, fontWeight: "700" },
	switchRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5, marginTop: 22 },
	switchText: { color: "#58665e", fontSize: 14 },
	switchAction: { color: "#315b49", fontSize: 14, fontWeight: "700", paddingVertical: 5 },
});
