
import { Stack } from "expo-router";

export default function RootLayout() {
  return (
    <Stack>
      <Stack.Screen
        name="index"
        options={{ title: "My Bear" }}
      />
      <Stack.Screen
        name="login"
        options={{ title: "Login" }}
      />
      <Stack.Screen
        name="register"
        options={{ title: "Register" }}
      />
      <Stack.Screen
        name="meals"
        options={{ title: "Meal Logger" }}
      />
      <Stack.Screen
        name="settings"
        options={{ title: "Settings" }}
      />
      <Stack.Screen
        name="steps"
        options={{ title: "My Steps" }}
      />
    </Stack>
  );
}
