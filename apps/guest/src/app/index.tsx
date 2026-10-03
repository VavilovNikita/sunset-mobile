import { router } from "expo-router";
import { Body, Card, Loading, Screen, Title } from "@sunset/ui";
import { useSession } from "../lib/session";

export default function Home() {
  const { ready, configured, account } = useSession();
  if (!configured) {
    return (
      <Screen>
        <Title>Not configured</Title>
        <Body muted>This build has no API address (EXPO_PUBLIC_API_BASE_URL). Rebuild it with one set - see .env.example.</Body>
      </Screen>
    );
  }
  if (!ready) return <Loading />;
  return (
    <Screen>
      <Title>{account?.name ? `Welcome, ${account.name}` : "Welcome"}</Title>
      <Card onPress={() => router.push("/rooms")}>
        <Body>Rooms & booking</Body>
        <Body muted>See prices for your dates and book.</Body>
      </Card>
      <Card onPress={() => router.push("/table/order")}>
        <Body>Order at your table</Body>
        <Body muted>Scan the QR code on your table in the restaurant or bar.</Body>
      </Card>
      <Card onPress={() => router.push("/account")}>
        <Body>{account ? "My bookings & room service" : "Sign in or create an account"}</Body>
      </Card>
    </Screen>
  );
}
