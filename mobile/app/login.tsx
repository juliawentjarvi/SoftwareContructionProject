
import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform
} from "react-native";
import { useRouter } from "expo-router";
import * as SecureStore from "expo-secure-store";
import api from "../src/services/api";

export default function LoginScreen() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!email.trim() || !password) {
      Alert.alert("Missing information", "Enter your email and password.");
      return;
    }

    setLoading(true);

    try {
      const response = await api.post("/api/auth/login", {
        email: email.trim(),
        password
      });

    await SecureStore.setItemAsync("token", response.data.token);
    
      router.replace("/");

      
    } catch (error: any) {
      Alert.alert(
        "Login failed",
        error.response?.data?.message ||
          "Could not connect to the server."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={styles.card}>
        <Text style={styles.bear}>🐻</Text>
        <Text style={styles.title}>Welcome back!</Text>
        <Text style={styles.subtitle}>
          Your bear is waiting for you.
        </Text>

        <TextInput
          style={styles.input}
          placeholder="Email"
          placeholderTextColor="#9A8C80"
          autoCapitalize="none"
          keyboardType="email-address"
          autoComplete="email"
          value={email}
          onChangeText={setEmail}
        />

        <TextInput
          style={styles.input}
          placeholder="Password"
          placeholderTextColor="#9A8C80"
          secureTextEntry
          autoComplete="password"
          value={password}
          onChangeText={setPassword}
        />

        <TouchableOpacity
          style={styles.button}
          onPress={handleLogin}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.buttonText}>Log In</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => router.push("/register")}
        >
          <Text style={styles.link}>
            Don't have an account? Sign up
          </Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFF8EF",
    justifyContent: "center",
    padding: 24
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 28,
    alignItems: "center"
  },
  bear: {
    fontSize: 72,
    marginBottom: 12
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#5C4033"
  },
  subtitle: {
    fontSize: 15,
    color: "#9A8C80",
    marginTop: 8,
    marginBottom: 28
  },
  input: {
    width: "100%",
    backgroundColor: "#FFF8EF",
    borderRadius: 12,
    padding: 15,
    marginBottom: 14,
    fontSize: 16,
    color: "#5C4033"
  },
  button: {
    width: "100%",
    backgroundColor: "#A67B5B",
    padding: 16,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 10
  },
  buttonText: {
    color: "#FFFFFF",
    fontSize: 17,
    fontWeight: "bold"
  },
  link: {
    marginTop: 24,
    color: "#A67B5B",
    fontSize: 14
  }
});
