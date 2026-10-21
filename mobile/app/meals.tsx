
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
import { useFocusEffect, router } from "expo-router";
import api from "../src/services/api";

type MealType = "breakfast" | "lunch" | "dinner" | "snack" | "other";

type Meal = {
  _id: string;
  name: string;
  type: MealType;
  eatenAt: string;
  energyAwarded?: number;
};

const mealTypes: MealType[] = [
  "breakfast",
  "lunch",
  "dinner",
  "snack",
  "other",
];

export default function MealsScreen() {
  const [meals, setMeals] = useState<Meal[]>([]);
  const [name, setName] = useState("");
  const [type, setType] = useState<MealType>("breakfast");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const loadMeals = useCallback(async () => {
    try {
      const response = await api.get("/api/meals");
      const data = response.data;

      setMeals(Array.isArray(data) ? data : data.meals ?? []);
    } catch (error) {
      console.log("Failed to load meals:", error);
      Alert.alert("Error", "Could not load your meals.");
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadMeals();
    }, [loadMeals])
  );

  async function addMeal() {
    if (!name.trim()) {
      Alert.alert("Missing meal", "Please enter what you ate.");
      return;
    }

    try {
      setSaving(true);

      await api.post("/api/meals", {
        name: name.trim(),
        type,
      });

      setName("");
      await loadMeals();

      Alert.alert("Meal logged! 🍎", "Your meal has been saved.");
    } catch (error) {
      console.log("Failed to add meal:", error);
      Alert.alert("Error", "Could not save your meal.");
    } finally {
      setSaving(false);
    }
  }

  function deleteMeal(id: string) {
    Alert.alert(
      "Delete meal?",
      "Are you sure you want to remove this meal?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await api.delete(`/api/meals/${id}`);
              await loadMeals();
            } catch (error) {
              console.log("Failed to delete meal:", error);
              Alert.alert("Error", "Could not delete the meal.");
            }
          },
        },
      ]
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
    >
      <Text style={styles.title}>🍎 My Meals</Text>
      <Text style={styles.subtitle}>
        Keep Teddy happy by tracking your meals!
      </Text>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Log a meal</Text>

        <TextInput
          style={styles.input}
          placeholder="What did you eat?"
          placeholderTextColor="#9B8B7A"
          value={name}
          onChangeText={setName}
        />

        <Text style={styles.label}>Meal type</Text>

        <View style={styles.typeContainer}>
          {mealTypes.map((mealType) => (
            <TouchableOpacity
              key={mealType}
              style={[
                styles.typeButton,
                type === mealType && styles.selectedType,
              ]}
              onPress={() => setType(mealType)}
            >
              <Text
                style={[
                  styles.typeText,
                  type === mealType && styles.selectedTypeText,
                ]}
              >
                {mealType.charAt(0).toUpperCase() +
                  mealType.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity
          style={[styles.addButton, saving && styles.disabled]}
          onPress={addMeal}
          disabled={saving}
        >
          <Text style={styles.addButtonText}>
            {saving ? "Saving..." : "+ Add Meal"}
          </Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.sectionTitle}>Meal history</Text>

      {loading ? (
        <ActivityIndicator size="large" color="#A87850" />
      ) : meals.length === 0 ? (
        <Text style={styles.emptyText}>
          No meals logged yet. Add your first meal! 🥣
        </Text>
      ) : (
        meals.map((meal) => (
          <View key={meal._id} style={styles.mealCard}>
            <View style={styles.mealInfo}>
              <Text style={styles.mealName}>{meal.name}</Text>

              <Text style={styles.mealDetails}>
                {meal.type} •{" "}
                {new Date(meal.eatenAt).toLocaleDateString()}
              </Text>

              {(meal.energyAwarded ?? 0) > 0 && (
                <Text style={styles.energyText}>
                  ⚡ +{meal.energyAwarded} energy
                </Text>
              )}
            </View>

            <TouchableOpacity
              onPress={() => deleteMeal(meal._id)}
              style={styles.deleteButton}
            >
              <Text style={styles.deleteText}>Delete</Text>
            </TouchableOpacity>
          </View>
        ))
      )}

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
    marginBottom: 30,
  },
  sectionTitle: {
    fontSize: 21,
    fontWeight: "bold",
    color: "#5C4033",
    marginBottom: 15,
  },
  input: {
    borderWidth: 1,
    borderColor: "#E3D5C3",
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    color: "#5C4033",
    marginBottom: 18,
  },
  label: {
    fontSize: 16,
    fontWeight: "600",
    color: "#5C4033",
    marginBottom: 10,
  },
  typeContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 22,
  },
  typeButton: {
    paddingVertical: 9,
    paddingHorizontal: 13,
    borderRadius: 20,
    backgroundColor: "#F2E8DB",
  },
  selectedType: {
    backgroundColor: "#A87850",
  },
  typeText: {
    color: "#6B5B4D",
    fontSize: 14,
  },
  selectedTypeText: {
    color: "#FFFFFF",
    fontWeight: "bold",
  },
  addButton: {
    backgroundColor: "#D6A77A",
    padding: 16,
    borderRadius: 12,
    alignItems: "center",
  },
  disabled: {
    opacity: 0.6,
  },
  addButtonText: {
    color: "#FFFFFF",
    fontSize: 17,
    fontWeight: "bold",
  },
  emptyText: {
    color: "#8B735B",
    fontSize: 15,
    textAlign: "center",
    marginVertical: 20,
  },
  mealCard: {
    backgroundColor: "#FFFFFF",
    padding: 16,
    borderRadius: 14,
    marginBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  mealInfo: {
    flex: 1,
    marginRight: 10,
  },
  mealName: {
    fontSize: 17,
    fontWeight: "bold",
    color: "#5C4033",
  },
  mealDetails: {
    fontSize: 13,
    color: "#8B735B",
    marginTop: 5,
    textTransform: "capitalize",
  },
  energyText: {
    color: "#B78B34",
    marginTop: 6,
    fontWeight: "600",
  },
  deleteButton: {
    padding: 10,
  },
  deleteText: {
    color: "#C76B61",
    fontWeight: "600",
  },
  backButton: {
    alignItems: "center",
    marginTop: 30,
  },
  backText: {
    color: "#8B5E3C",
    fontSize: 16,
    fontWeight: "600",
  },
});
