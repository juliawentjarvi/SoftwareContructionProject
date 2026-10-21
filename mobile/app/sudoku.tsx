
import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  StyleSheet,
} from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import api from "../src/services/api";

// Sudoku puzzle: 0 means an empty square.
const PUZZLE =
  "530070000" +
  "600195000" +
  "098000060" +
  "800060003" +
  "400803001" +
  "700020006" +
  "060000280" +
  "000419005" +
  "000080079";

const SOLUTION =
  "534678912" +
  "672195348" +
  "198342567" +
  "859761423" +
  "426853791" +
  "713924856" +
  "961537284" +
  "287419635" +
  "345286179";

const GAME_COST = 5;

type SavedGame = {
  started: true;
  board: string[];
  completed: boolean;
};

function isValidSavedGame(value: unknown): value is SavedGame {
  if (!value || typeof value !== "object") {
    return false;
  }

  const data = value as Partial<SavedGame>;

  if (
    data.started !== true ||
    typeof data.completed !== "boolean" ||
    !Array.isArray(data.board) ||
    data.board.length !== 81
  ) {
    return false;
  }

  return data.board.every((cell, index) => {
    if (typeof cell !== "string" || !/^[0-9]$/.test(cell)) {
      return false;
    }

    // Original puzzle numbers cannot be changed.
    return PUZZLE[index] === "0" || cell === PUZZLE[index];
  });
}

// Returns true when a number appears more than once
// in its row, column, or 3x3 box.
function hasConflict(board: string[], index: number): boolean {
  const value = board[index];

  if (value === "0") {
    return false;
  }

  const row = Math.floor(index / 9);
  const column = index % 9;

  for (let other = 0; other < 81; other++) {
    if (other === index || board[other] !== value) {
      continue;
    }

    const otherRow = Math.floor(other / 9);
    const otherColumn = other % 9;

    const sameRow = row === otherRow;
    const sameColumn = column === otherColumn;

    const sameBox =
      Math.floor(row / 3) === Math.floor(otherRow / 3) &&
      Math.floor(column / 3) === Math.floor(otherColumn / 3);

    if (sameRow || sameColumn || sameBox) {
      return true;
    }
  }

  return false;
}

export default function SudokuScreen() {
  const router = useRouter();

  const [started, setStarted] = useState(false);
  const [starting, setStarting] = useState(false);
  const [saveLoaded, setSaveLoaded] = useState(false);
  const [board, setBoard] = useState<string[]>(PUZZLE.split(""));
  const [selected, setSelected] = useState<number | null>(null);
  const [completed, setCompleted] = useState(false);
  const [energy, setEnergy] = useState<number | null>(null);

  // Keep save operations in order so an older board
  // cannot overwrite a newer board.
  const saveQueue = useRef<Promise<void>>(Promise.resolve());
  const storageKey = useRef<string | null>(null);
  const gameRef = useRef<SavedGame | null>(null);
  const startingRef = useRef(false);

  function queueSave(game: SavedGame) {
    const key = storageKey.current;

    if (!key) {
      return;
    }

    gameRef.current = game;

    saveQueue.current = saveQueue.current
      .catch(() => {})
      .then(async () => {
        await AsyncStorage.setItem(key, JSON.stringify(game));
      })
      .catch((error) => {
        console.error("Could not save Sudoku:", error);
      });
  }

  // Load a saved game for the current login.
  useEffect(() => {
    let active = true;

    async function loadSavedGame() {
      try {
        const token = await SecureStore.getItemAsync("token");

        if (!token) {
          return;
        }

        // Each login token gets its own local save.
        // The token itself is not used as a storage key.
        const key = `teddy_sudoku_${token.slice(-16)}`;
        const saved = await AsyncStorage.getItem(key);

        if (!active) {
          return;
        }

        storageKey.current = key;

        if (saved) {
          const parsed: unknown = JSON.parse(saved);

          if (isValidSavedGame(parsed)) {
            gameRef.current = parsed;
            setBoard(parsed.board);
            setCompleted(parsed.completed);
            setStarted(true);
          }
        }
      } catch (error) {
        console.error("Could not load Sudoku:", error);
      } finally {
        if (active) {
          setSaveLoaded(true);
        }
      }
    }

    loadSavedGame();

    return () => {
      active = false;
    };
  }, []);

  // Refresh energy when returning to Sudoku.
  useFocusEffect(
    useCallback(() => {
      let active = true;

      async function loadEnergy() {
        try {
          const response = await api.get("/api/bear");
          const bear = response.data.bear ?? response.data;

          if (active) {
            setEnergy(bear.energy);
          }
        } catch (error) {
          console.error("Could not load Teddy's energy:", error);
        }
      }

      loadEnergy();

      return () => {
        active = false;
      };
    }, [])
  );

  async function startGame() {
    if (startingRef.current || !saveLoaded || !storageKey.current) {
      return;
    }

    startingRef.current = true;
    setStarting(true);

    try {
      // Backend checks the energy and deducts 5 atomically.
      const response = await api.post("/api/sudoku/start");

      setEnergy(response.data.totalEnergy);

      const newBoard = PUZZLE.split("");

      const newGame: SavedGame = {
        started: true,
        board: newBoard,
        completed: false,
      };

      // Save the paid game before displaying it.
      queueSave(newGame);
      await saveQueue.current;

      setBoard(newBoard);
      setSelected(null);
      setCompleted(false);
      setStarted(true);

      Alert.alert(
        "Sudoku Started! 🧩",
        "5 energy has been deducted from Teddy."
      );
    } catch (error: any) {
      const message =
        error?.response?.data?.message ??
        "Could not start Sudoku. Please try again.";

      Alert.alert("Cannot Start Game", message);
    } finally {
      startingRef.current = false;
      setStarting(false);
    }
  }

  function enterNumber(value: string) {
    if (
      !started ||
      starting ||
      selected === null ||
      PUZZLE[selected] !== "0" ||
      completed
    ) {
      return;
    }

    const current = gameRef.current?.board ?? board;

    if (
      value !== "0" &&
      current.filter((cell) => cell === value).length >= 9 &&
      current[selected] !== value
    ) {
      return;
    }

    const next = [...current];
    next[selected] = value;

    if (next[selected] === current[selected]) {
      return;
    }

    const solved = next.join("") === SOLUTION;
    const full = !next.includes("0");

    const updatedGame: SavedGame = {
      started: true,
      board: next,
      completed: solved,
    };

    // Save every move automatically.
    queueSave(updatedGame);

    setBoard(next);
    setCompleted(solved);

    // Check automatically once all squares are filled.
    if (full) {
      if (solved) {
        Alert.alert(
          "You Won! 🎉🐻",
          "Amazing! You solved Teddy's Sudoku!"
        );
      } else {
        Alert.alert(
          "Not Quite Right 🧩",
          "Some numbers are incorrect. Keep trying!"
        );
      }
    }
  }

  function checkAnswer() {
    if (board.includes("0")) {
      Alert.alert(
        "Not Finished Yet",
        "Fill in all the empty squares first."
      );
      return;
    }

    if (board.join("") === SOLUTION) {
      if (!completed) {
        setCompleted(true);
        queueSave({
          started: true,
          board,
          completed: true,
        });
      }

      Alert.alert(
        "You Won! 🎉🐻",
        "Amazing! You solved Teddy's Sudoku!"
      );
    } else {
      Alert.alert(
        "Try Again 🐻",
        "Some numbers are incorrect. Keep trying!"
      );
    }
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
    >
      <Text style={styles.title}>
        🐻 Teddy's Sudoku 🧩
      </Text>

      <Text style={styles.description}>
        Each new game costs {GAME_COST} energy ⚡
      </Text>

      {energy !== null && (
        <Text style={styles.energy}>
          Teddy's Energy: {energy}/100 ⚡
        </Text>
      )}

      {!saveLoaded ? (
        <ActivityIndicator size="large" color="#8BC34A" />
      ) : !started ? (
        <TouchableOpacity
          style={[
            styles.startButton,
            starting && styles.disabledButton,
          ]}
          onPress={startGame}
          disabled={starting}
        >
          <Text style={styles.buttonText}>
            {starting
              ? "Starting..."
              : "▶ Start Game — 5 ⚡"}
          </Text>
        </TouchableOpacity>
      ) : (
        <>
          <Text style={styles.progressText}>
            {completed
              ? "🏆 Puzzle solved!"
              : "💾 Progress saves automatically"}
          </Text>

          <View style={styles.board}>
            {board.map((value, index) => {
              const row = Math.floor(index / 9);
              const column = index % 9;
              const fixed = PUZZLE[index] !== "0";
              const conflict = hasConflict(board, index);

              return (
                <TouchableOpacity
                  key={index}
                  onPress={() => {
                    if (!fixed && !completed && !starting) {
                      setSelected(index);
                    }
                  }}
                  style={[
                    styles.cell,
                    column % 3 === 2 &&
                      column !== 8 &&
                      styles.thickRight,
                    row % 3 === 2 &&
                      row !== 8 &&
                      styles.thickBottom,
                    fixed && styles.fixedCell,
                    selected === index && styles.selectedCell,
                  ]}
                >
                  <Text
                    style={[
                      styles.cellText,
                      fixed && styles.fixedText,
                      conflict && styles.errorText,
                    ]}
                  >
                    {value === "0" ? "" : value}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <Text style={styles.hint}>
            Red numbers conflict with another number.
          </Text>

          <View style={styles.numberRow}>
            {Array.from({ length: 9 }, (_, i) => {
              const value = String(i + 1);
              const count = board.filter(
                (cell) => cell === value
              ).length;
              const maxReached = count >= 9;

              return (
                <TouchableOpacity
                  key={value}
                  style={[
                    styles.numberButton,
                    maxReached && styles.disabledNumber,
                  ]}
                  disabled={
                    maxReached || completed || starting
                  }
                  onPress={() => enterNumber(value)}
                >
                  <Text
                    style={[
                      styles.numberText,
                      maxReached && styles.disabledText,
                    ]}
                  >
                    {value}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <TouchableOpacity
            style={styles.eraseButton}
            onPress={() => enterNumber("0")}
            disabled={completed || starting}
          >
            <Text style={styles.buttonText}>
              ⌫ Erase
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.checkButton}
            onPress={checkAnswer}
            disabled={completed || starting}
          >
            <Text style={styles.buttonText}>
              {completed
                ? "🏆 Puzzle Solved!"
                : "✓ Check Answer"}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.startButton,
              starting && styles.disabledButton,
            ]}
            onPress={startGame}
            disabled={starting}
          >
            <Text style={styles.buttonText}>
              {starting
                ? "Starting..."
                : "🔄 New Game — 5 ⚡"}
            </Text>
          </TouchableOpacity>
        </>
      )}

      <TouchableOpacity
        style={styles.homeButton}
        onPress={() => router.replace("/")}
      >
        <Text style={styles.buttonText}>
          🏠 Back to Home
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFF8EE",
  },
  content: {
    padding: 16,
    paddingTop: 55,
    alignItems: "center",
    paddingBottom: 40,
  },
  title: {
    fontSize: 27,
    fontWeight: "bold",
    color: "#5D4037",
    marginBottom: 10,
  },
  description: {
    fontSize: 16,
    color: "#795548",
    marginBottom: 12,
  },
  energy: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#FF9800",
    marginBottom: 12,
  },
  progressText: {
    fontSize: 14,
    color: "#558B2F",
    marginBottom: 14,
  },
  board: {
    width: "100%",
    maxWidth: 360,
    aspectRatio: 1,
    flexDirection: "row",
    flexWrap: "wrap",
    borderWidth: 2,
    borderColor: "#5D4037",
  },
  cell: {
    width: "11.111111%",
    height: "11.111111%",
    borderWidth: 0.5,
    borderColor: "#BCAAA4",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
  },
  thickRight: {
    borderRightWidth: 2,
    borderRightColor: "#5D4037",
  },
  thickBottom: {
    borderBottomWidth: 2,
    borderBottomColor: "#5D4037",
  },
  fixedCell: {
    backgroundColor: "#EFEBE9",
  },
  selectedCell: {
    backgroundColor: "#FFE082",
  },
  cellText: {
    fontSize: 19,
    color: "#1976D2",
  },
  fixedText: {
    color: "#4E342E",
    fontWeight: "bold",
  },
  errorText: {
    color: "#E53935",
    fontWeight: "bold",
  },
  hint: {
    marginTop: 10,
    fontSize: 13,
    color: "#795548",
  },
  numberRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: "100%",
    maxWidth: 360,
    marginTop: 22,
  },
  numberButton: {
    flex: 1,
    marginHorizontal: 2,
    backgroundColor: "#D7CCC8",
    borderRadius: 6,
    paddingVertical: 11,
    alignItems: "center",
  },
  disabledNumber: {
    backgroundColor: "#E0E0E0",
    opacity: 0.4,
  },
  numberText: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#4E342E",
  },
  disabledText: {
    color: "#9E9E9E",
  },
  startButton: {
    backgroundColor: "#8BC34A",
    padding: 16,
    borderRadius: 12,
    marginTop: 18,
    width: "100%",
    alignItems: "center",
  },
  disabledButton: {
    opacity: 0.5,
  },
  eraseButton: {
    backgroundColor: "#A1887F",
    padding: 14,
    borderRadius: 12,
    marginTop: 16,
    width: "100%",
    alignItems: "center",
  },
  checkButton: {
    backgroundColor: "#FF9800",
    padding: 16,
    borderRadius: 12,
    marginTop: 16,
    width: "100%",
    alignItems: "center",
  },
  homeButton: {
    backgroundColor: "#795548",
    padding: 16,
    borderRadius: 12,
    marginTop: 24,
    width: "100%",
    alignItems: "center",
  },
  buttonText: {
    fontSize: 17,
    fontWeight: "bold",
    color: "#FFFFFF",
  },
});
