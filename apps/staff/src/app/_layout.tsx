import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { colors } from "@sunset/ui";
import { SessionProvider } from "../lib/session";

export default function RootLayout() {
  return (
    <SessionProvider>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.ink } }} />
    </SessionProvider>
  );
}
