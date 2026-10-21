
import { useCallback, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from "react-native";
import { router, useFocusEffect } from "expo-router";
import api from "../src/services/api";

export default function SettingsScreen() {
  const [bearName, setBearName] = useState("");
  const [mealGoal, setMealGoal] = useState("3");
  const [loading, setLoading] = useState(true);
  const [savingName, setSavingName] = useState(false);

  const loadSettings = useCallback(async () => {
    try {
      const [bearResponse, settingsResponse] = await Promise.all([
        api.get("/api/bear"),
        api.get("/api/settings"),
        ]);

        const bear = bearResponse.data.bear ?? bearResponse.data;

        setBearName(bear.name ?? "Teddy");
        setMealGoal(String(settingsResponse.data.dailyMealGoal ?? 3));
    } catch (error) {
      console.log("Failed to load settings:", error);
      Alert.alert("Error", "Could not load Teddy's settings.");
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadSettings();
    }, [loadSettings])
  );

  async function saveBearName() {
    const trimmedName = bearName.trim();

    if (!trimmedName) {
      Alert.alert("Missing name", "Please enter a name for your bear.");
      return;
    }

    try {
      setSavingName(true);

      await api.patch("/api/bear/name", {
        name: trimmedName,
      });

      setBearName(trimmedName);
      Alert.alert("Saved! 🐻", "Your bear's name has been updated.");
    } catch (error) {
      console.log("Failed to save bear name:", error);
      Alert.alert("Error", "Could not update your bear's name.");
    } finally {
      setSavingName(false);
    }
  }

  async function saveMealGoal() {
    try {
        await api.patch("/api/settings", {
        dailyMealGoal: Number(mealGoal),
        });

        Alert.alert("Saved! 🍎", "Your daily meal goal has been updated.");
    } catch (error) {
        console.log("Failed to save meal goal:", error);
        Alert.alert("Error", "Could not save your daily meal goal.");
    }
    }

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#A87850" />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
    >
      <Text style={styles.title}>⚙️ Settings</Text>
      <Text style={styles.subtitle}>
        Make your bear-care experience your own!
      </Text>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>🐻 Bear's Name</Text>

        <Text style={styles.description}>
          Give your bear a special name.
        </Text>

        <TextInput
          style={styles.input}
          value={bearName}
          onChangeText={setBearName}
          placeholder="Enter bear name"
          placeholderTextColor="#9B8B7A"
          maxLength={30}
        />

        <TouchableOpacity
          style={[
            styles.saveButton,
            savingName && styles.disabledButton,
          ]}
          onPress={saveBearName}
          disabled={savingName}
        >
          <Text style={styles.saveButtonText}>
            {savingName ? "Saving..." : "Save Bear Name"}
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>🍎 Daily Meal Goal</Text>

        <Text style={styles.description}>
          Choose how many meals you want to track each day.
        </Text>

        <View style={styles.goalRow}>
          {["2", "3", "4", "5"].map((goal) => (
            <TouchableOpacity
              key={goal}
              style={[
                styles.goalButton,
                mealGoal === goal && styles.selectedGoal,
              ]}
              onPress={() => setMealGoal(goal)}
            >
              <Text
                style={[
                  styles.goalText,
                  mealGoal === goal && styles.selectedGoalText,
                ]}
              >
                {goal}
              </Text>
            </TouchableOpacity>
          ))}
        
        </View>

          <TouchableOpacity
            style={styles.saveButton}
            onPress={saveMealGoal}
            
            >
            <Text style={styles.saveButtonText}>
                Save Meal Goal
            </Text>
            </TouchableOpacity>


        <Text style={styles.note}>
          Goal selection is a preview for now. We'll connect saving
          this setting to your backend next.
        </Text>

      </View>



      <TouchableOpacity
        style={styles.backButton}
        onPress={() => router.replace("/")}
      >
        <Text style={styles.backText}>← Back to Teddy 🐻</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFF8ED",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    backgroundColor: "#FFF8ED",
  },
  content: {
    padding: 24,
    paddingBottom: 50,
  },
  title: {
    fontSize: 30,
    fontWeight: "bold",
    color: "#5C4033",
    textAlign: "center",
    marginTop: 20,
  },
  subtitle: {
    fontSize: 15,
    color: "#8B735B",
    textAlign: "center",
    marginTop: 8,
    marginBottom: 25,
  },
  card: {
    backgroundColor: "#FFFFFF",
    padding: 20,
    borderRadius: 20,
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 21,
    fontWeight: "bold",
    color: "#5C4033",
    marginBottom: 10,
  },
  description: {
    color: "#8B735B",
    fontSize: 15,
    marginBottom: 16,
  },
  input: {
    borderWidth: 1,
    borderColor: "#E3D5C3",
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    color: "#5C4033",
    marginBottom: 16,
  },
  saveButton: {
    backgroundColor: "#D6A77A",
    padding: 16,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 20,
  },
  disabledButton: {
    opacity: 0.6,
  },
  saveButtonText: {
    color: "#FFFFFF",
    fontSize: 17,
    fontWeight: "bold",
  },
  goalRow: {
    flexDirection: "row",
    gap: 10,
    justifyContent: "space-between",
  },
  goalButton: {
    flex: 1,
    backgroundColor: "#F2E8DB",
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
  },
  selectedGoal: {
    backgroundColor: "#A87850",
  },
  goalText: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#6B5B4D",
  },
  selectedGoalText: {
    color: "#FFFFFF",
  },
  note: {
    fontSize: 13,
    color: "#8B735B",
    marginTop: 14,
    fontStyle: "italic",
  },
  backButton: {
    alignItems: "center",
    marginTop: 25,
  },
  backText: {
    color: "#8B5E3C",
    fontSize: 16,
    fontWeight: "600",
  },
});
