
import { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
} from "react-native";
import { router } from "expo-router";
import * as SecureStore from "expo-secure-store";
import api from "../src/services/api";

export default function HomeScreen() {
  const [bearName, setBearName] = useState("Teddy");
  const [energy, setEnergy] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadBear() {
      try {
        const token = await SecureStore.getItemAsync("token");

        if (!token) {
          router.replace("/login");
          return;
        }

        const response = await api.get("/api/bear");

        // Supports either { bear: {...} } or a direct bear object.
        const bear = response.data.bear ?? response.data;

        setBearName(bear.name ?? "Teddy");
        setEnergy(bear.energy ?? 0);
      } catch (error) {
        console.log("Failed to load bear:", error);
      } finally {
        setLoading(false);
      }
    }

    loadBear();
  }, []);

  async function handleLogout() {
    await SecureStore.deleteItemAsync("token");
    router.replace("/login");
  }

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>My Bear 🐻</Text>

      <Text style={styles.bear}>🐻</Text>

      <Text style={styles.name}>{bearName}</Text>

      <Text style={styles.energy}>⚡ Energy: {energy}/100</Text>

      <TouchableOpacity
        style={styles.button}
        onPress={() => router.push("/meals")}
      >
        <Text style={styles.buttonText}>🍎 My Meals</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.button}
        onPress={() => router.push("/steps")}
      >
        <Text style={styles.buttonText}>👟 My Steps</Text>
      </TouchableOpacity>


      <TouchableOpacity
        style={{
          backgroundColor: "#6ac8e0",
          padding: 16,
          borderRadius: 12,
          marginBottom: 12,
          alignItems: "center",
        }}
        onPress={() => router.push("/sudoku")}
      >
        <Text
          style={{
            color: "white",
            fontSize: 17,
            fontWeight: "bold",
          }}
        >
          🧩 Play Sudoku — 5 ⚡
        </Text>
      </TouchableOpacity>



      <TouchableOpacity
        style={styles.button}
        onPress={() => router.push("/settings")}
      >
        <Text style={styles.buttonText}>⚙️ Settings</Text>
      </TouchableOpacity>


      <TouchableOpacity onPress={handleLogout}>
        <Text style={styles.logout}>Log Out</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFF8ED",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  title: {
    fontSize: 32,
    fontWeight: "bold",
    color: "#5C4033",
    marginBottom: 30,
  },
  bear: {
    fontSize: 110,
    marginBottom: 15,
  },
  name: {
    fontSize: 26,
    fontWeight: "bold",
    color: "#5C4033",
  },
  energy: {
    fontSize: 20,
    marginTop: 12,
    marginBottom: 35,
    color: "#6B5B4D",
  },
  button: {
    backgroundColor: "#D6A77A",
    paddingVertical: 15,
    paddingHorizontal: 40,
    borderRadius: 15,
    marginBottom: 15,
    minWidth: 220,
    alignItems: "center",
  },
  buttonText: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "bold",
  },
  logout: {
    color: "#8B5E3C",
    fontSize: 16,
    marginTop: 25,
    textDecorationLine: "underline",
  },
});
