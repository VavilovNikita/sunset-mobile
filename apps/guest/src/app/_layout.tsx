import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { colors } from "@sunset/ui";
import { SessionProvider } from "../lib/session";

export default function RootLayout() {
  return (
    <SessionProvider>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.ink2 },
          headerTintColor: colors.cream,
          contentStyle: { backgroundColor: colors.ink },
        }}
      >
        <Stack.Screen name="index" options={{ title: "The Sunset Beach" }} />
        <Stack.Screen name="rooms/index" options={{ title: "Rooms" }} />
        <Stack.Screen name="rooms/[id]" options={{ title: "Room" }} />
        <Stack.Screen name="account/index" options={{ title: "My account" }} />
        <Stack.Screen name="account/login" options={{ title: "Sign in" }} />
        <Stack.Screen name="account/register" options={{ title: "Create an account" }} />
        <Stack.Screen name="account/forgot" options={{ title: "Forgot password" }} />
        <Stack.Screen name="room-service/[bookingId]" options={{ title: "Room service" }} />
        <Stack.Screen name="table/scan" options={{ title: "Scan your table" }} />
        <Stack.Screen name="table/order" options={{ title: "Order at your table" }} />
      </Stack>
    </SessionProvider>
  );
}
