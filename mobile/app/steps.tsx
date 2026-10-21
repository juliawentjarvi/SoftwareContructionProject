
import React, { useCallback, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  StyleSheet,
} from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { Pedometer } from "expo-sensors";
import api from "../src/services/api";

type StepRewardResponse = {
  stepsToday: number;
  stepsRewarded: number;
  energyAwarded: number;
  totalEnergy: number;
};

export default function StepsScreen() {
  const router = useRouter();

  const [steps, setSteps] = useState(0);
  const [energyEarned, setEnergyEarned] = useState(0);
  const [totalEnergy, setTotalEnergy] = useState<number | null>(
    null
  );
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const loadSteps = useCallback(async () => {
    setLoading(true);
    setMessage("");

    try {
      const available = await Pedometer.isAvailableAsync();

      if (!available) {
        setMessage("Step tracking is not available.");
        return;
      }

      const permission =
        await Pedometer.requestPermissionsAsync();

      if (!permission.granted) {
        setMessage("Please allow access to your steps.");
        return;
      }

      // Count steps since local midnight.
      const now = new Date();
      const startOfDay = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate()
      );

      const stepResult =
        await Pedometer.getStepCountAsync(
          startOfDay,
          now
        );

      const todaySteps = stepResult.steps;
      setSteps(todaySteps);

      // Send steps to the backend for energy rewards.
      const response = await api.post<StepRewardResponse>(
        "/api/steps",
        {
          steps: todaySteps,
        }
      );

      setEnergyEarned(response.data.energyAwarded);
      setTotalEnergy(response.data.totalEnergy);

      if (response.data.energyAwarded > 0) {
        setMessage(
          `Teddy earned +${response.data.energyAwarded} energy! 🎉`
        );
      } else {
        setMessage(
          "Steps synced! No new energy reward yet."
        );
      }
    } catch (error: any) {
      console.error("Step sync failed:", error);

      const errorMessage =
        error?.response?.data?.message ??
        error?.message ??
        "Unknown error";

      setMessage(`Could not sync steps: ${errorMessage}`);

      Alert.alert(
        "Step Sync Error",
        "Your steps could not be sent to the backend."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadSteps();
    }, [loadSteps])
  );

  return (
    <View style={styles.container}>
      <Text style={styles.title}>🐻 Teddy's Steps 👟</Text>

      <Text style={styles.label}>Today's Steps</Text>
      <Text style={styles.steps}>{steps.toLocaleString()}</Text>

      <Text style={styles.label}>Energy Earned This Sync</Text>
      <Text style={styles.energy}>
        +{energyEarned} ⚡
      </Text>

      <Text style={styles.label}>Teddy's Total Energy</Text>
      <Text style={styles.energy}>
        {totalEnergy === null
          ? "—"
          : `${totalEnergy} / 100 ⚡`}
      </Text>

      {loading ? (
        <ActivityIndicator size="large" />
      ) : (
        <Text style={styles.message}>{message}</Text>
      )}

      <TouchableOpacity
        style={styles.button}
        onPress={loadSteps}
        disabled={loading}
      >
        <Text style={styles.buttonText}>
          🔄 Refresh Steps
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.backButton}
        onPress={() => router.replace("/")}
      >
        <Text style={styles.buttonText}>
          🏠 Back to Home
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
    paddingTop: 70,
    backgroundColor: "#FFF8EE",
    alignItems: "center",
  },
  title: {
    fontSize: 27,
    fontWeight: "bold",
    marginBottom: 35,
    color: "#5D4037",
  },
  label: {
    fontSize: 17,
    marginTop: 18,
    color: "#795548",
  },
  steps: {
    fontSize: 48,
    fontWeight: "bold",
    color: "#4CAF50",
  },
  energy: {
    fontSize: 30,
    fontWeight: "bold",
    color: "#FF9800",
  },
  message: {
    fontSize: 15,
    textAlign: "center",
    marginVertical: 24,
    color: "#5D4037",
  },
  button: {
    backgroundColor: "#8BC34A",
    padding: 16,
    borderRadius: 12,
    marginTop: 15,
    width: "100%",
    alignItems: "center",
  },
  backButton: {
    backgroundColor: "#A1887F",
    padding: 16,
    borderRadius: 12,
    marginTop: 15,
    width: "100%",
    alignItems: "center",
  },
  buttonText: {
    color: "white",
    fontSize: 17,
    fontWeight: "bold",
  },
});
