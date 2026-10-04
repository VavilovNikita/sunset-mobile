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
      <Stack.Screen name="today" options={{ title: "Today" }} />
      <Stack.Screen name="bookings/index" options={{ title: "Bookings" }} />
      <Stack.Screen name="bookings/[id]" options={{ title: "Booking" }} />
      <Stack.Screen name="bookings/new" options={{ title: "New booking" }} />
      <Stack.Screen name="calendar" options={{ title: "Calendar" }} />
      <Stack.Screen name="reports/index" options={{ title: "Reports" }} />
      <Stack.Screen name="reports/manager" options={{ title: "Manager report" }} />
      <Stack.Screen name="reports/occupancy" options={{ title: "Occupancy" }} />
      <Stack.Screen name="reports/segments" options={{ title: "Market segments" }} />
      <Stack.Screen name="reports/sales" options={{ title: "POS sales" }} />
      <Stack.Screen name="reports/forecast" options={{ title: "Forecast" }} />
      <Stack.Screen name="history" options={{ title: "History" }} />
      <Stack.Screen name="settings/index" options={{ title: "Settings" }} />
      <Stack.Screen name="settings/menu" options={{ title: "Menu & treatments" }} />
      <Stack.Screen name="settings/tables" options={{ title: "Tables" }} />
      <Stack.Screen name="settings/rooms" options={{ title: "Rooms" }} />
      <Stack.Screen name="settings/rates" options={{ title: "Rates" }} />
      <Stack.Screen name="settings/roster" options={{ title: "Roster" }} />
      <Stack.Screen name="settings/printers" options={{ title: "Printers" }} />
      <Stack.Screen name="settings/devices" options={{ title: "Fingerprint terminals" }} />
      <Stack.Screen name="settings/users" options={{ title: "Users" }} />
      <Stack.Screen name="settings/emails" options={{ title: "Guest emails" }} />
      <Stack.Screen name="in-house" options={{ title: "In house" }} />
      <Stack.Screen name="rooms-map" options={{ title: "Rooms" }} />
      <Stack.Screen name="guests/index" options={{ title: "Guests" }} />
      <Stack.Screen name="guests/[id]" options={{ title: "Guest" }} />
      <Stack.Screen name="night-audit" options={{ title: "Night audit" }} />
    </Stack>
  );
}
