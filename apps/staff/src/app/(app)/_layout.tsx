import { Redirect, Stack } from "expo-router";
import { Body, Loading, Screen, Title, colors } from "@sunset/ui";
import { useSession } from "../../lib/session";

export default function SignedInLayout() {
  const { status } = useSession();
  if (status === "misconfigured") {
    return (
      <Screen>
        <Title>Not configured</Title>
        <Body muted>This build has no API address (EXPO_PUBLIC_API_BASE_URL). Rebuild it with one set - see .env.example.</Body>
      </Screen>
    );
  }
  if (status === "loading") return <Loading label="Checking your sign-in…" />;
  if (status === "signedOut") return <Redirect href="/login" />;
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.ink2 },
        headerTintColor: colors.cream,
        contentStyle: { backgroundColor: colors.ink },
      }}
    >
      <Stack.Screen name="index" options={{ title: "Sunset Beach" }} />
      <Stack.Screen name="pos/index" options={{ title: "Tables & orders" }} />
      <Stack.Screen name="pos/order/[id]" options={{ title: "Order" }} />
      <Stack.Screen name="shift" options={{ title: "Cash shift" }} />
      <Stack.Screen name="print" options={{ title: "Printing" }} />
      <Stack.Screen name="housekeeping" options={{ title: "Housekeeping" }} />
      <Stack.Screen name="maintenance/index" options={{ title: "Maintenance" }} />
      <Stack.Screen name="maintenance/new" options={{ title: "Report a problem" }} />
      <Stack.Screen name="spa/index" options={{ title: "Spa schedule" }} />
      <Stack.Screen name="spa/book" options={{ title: "Book a treatment" }} />
      <Stack.Screen name="roster" options={{ title: "My schedule" }} />
    </Stack>
  );
}
