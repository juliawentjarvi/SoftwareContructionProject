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
import api, { AuthSession, errorMessage } from "../src/services/api";
import ApiConnectionSettings from "../src/components/ApiConnectionSettings";

interface RegisterScreenProps {
	onAuthenticated: (session: AuthSession) => void;
	onSignIn: () => void;
}

export default function RegisterScreen({ onAuthenticated, onSignIn }: RegisterScreenProps) {
	const [email, setEmail] = useState("");
	const [displayName, setDisplayName] = useState("");
	const [password, setPassword] = useState("");
	const [confirmPassword, setConfirmPassword] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [isSubmitting, setIsSubmitting] = useState(false);

	const handleRegister = async () => {
		setError(null);
		if (!email.trim() || !displayName.trim() || !password || !confirmPassword) {
			setError("Complete all fields to create your account.");
			return;
		}
		if (password.length < 10) {
			setError("Use at least 10 characters for your password.");
			return;
		}
		if (password !== confirmPassword) {
			setError("Those passwords don't match.");
			return;
		}

		setIsSubmitting(true);
		try {
			const result = await api.register(email.trim(), password, displayName.trim());
			if (!result.ok) {
				setError(errorMessage(result.body, "We couldn't create your account. Try again."));
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
				<Text style={styles.title}>Create your account</Text>
				<Text style={styles.subtitle}>A little care starts with a check-in.</Text>

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
					<Text style={styles.label}>Display name</Text>
					<TextInput
						style={styles.input}
						value={displayName}
						onChangeText={setDisplayName}
						placeholder="What should we call you?"
						placeholderTextColor="#7b8780"
						autoCapitalize="words"
						maxLength={60}
						accessibilityLabel="Display name"
					/>
					<Text style={styles.label}>Password</Text>
					<TextInput
						style={styles.input}
						value={password}
						onChangeText={setPassword}
						placeholder="At least 10 characters"
						placeholderTextColor="#7b8780"
						secureTextEntry
						autoComplete="new-password"
						textContentType="newPassword"
						accessibilityLabel="Password"
					/>
					<Text style={styles.label}>Confirm password</Text>
					<TextInput
						style={styles.input}
						value={confirmPassword}
						onChangeText={setConfirmPassword}
						placeholder="Enter your password again"
						placeholderTextColor="#7b8780"
						secureTextEntry
						returnKeyType="done"
						autoComplete="new-password"
						textContentType="newPassword"
						accessibilityLabel="Confirm password"
						onSubmitEditing={handleRegister}
					/>
					{error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
					<Pressable
						style={({ pressed }) => [styles.submit, pressed && !isSubmitting && styles.submitPressed, isSubmitting && styles.submitDisabled]}
						onPress={handleRegister}
						disabled={isSubmitting}
						accessibilityRole="button"
					>
						{isSubmitting ? <ActivityIndicator color="#ffffff" /> : <Text style={styles.submitText}>Create account</Text>}
					</Pressable>
				</View>

				<View style={styles.switchRow}>
					<Text style={styles.switchText}>Already have an account?</Text>
					<Pressable onPress={onSignIn} accessibilityRole="button">
						<Text style={styles.switchAction}>Sign in</Text>
					</Pressable>
				</View>
				<ApiConnectionSettings />
			</ScrollView>
		</KeyboardAvoidingView>
	);
}

const styles = StyleSheet.create({
	screen: { flex: 1, backgroundColor: "#eef3ed" },
	content: { flexGrow: 1, justifyContent: "center", paddingHorizontal: 24, paddingVertical: 36 },
	brand: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 28 },
	brandMark: { width: 38, height: 38, borderRadius: 19, backgroundColor: "#315b49", alignItems: "center", justifyContent: "center" },
	brandMarkText: { color: "#ffffff", fontSize: 19, fontWeight: "700" },
	brandName: { color: "#315b49", fontSize: 13, fontWeight: "800", letterSpacing: 1.2 },
	title: { color: "#1d2923", fontSize: 28, fontWeight: "700", marginBottom: 7 },
	subtitle: { color: "#58665e", fontSize: 15, marginBottom: 22 },
	form: { backgroundColor: "#ffffff", borderRadius: 12, padding: 20, borderWidth: 1, borderColor: "#dce5dc" },
	label: { color: "#2c3c33", fontSize: 13, fontWeight: "600", marginBottom: 7, marginTop: 4 },
	input: { minHeight: 48, borderWidth: 1, borderColor: "#cbd6cd", borderRadius: 7, paddingHorizontal: 12, color: "#1d2923", marginBottom: 14, fontSize: 16 },
	error: { color: "#a6372d", fontSize: 14, marginBottom: 12 },
	submit: { minHeight: 50, backgroundColor: "#c5523e", borderRadius: 7, alignItems: "center", justifyContent: "center", marginTop: 4 },
	submitPressed: { backgroundColor: "#a94132" },
	submitDisabled: { opacity: 0.7 },
	submitText: { color: "#ffffff", fontSize: 16, fontWeight: "700" },
	switchRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5, marginTop: 22 },
	switchText: { color: "#58665e", fontSize: 14 },
	switchAction: { color: "#315b49", fontSize: 14, fontWeight: "700", paddingVertical: 5 },
});
