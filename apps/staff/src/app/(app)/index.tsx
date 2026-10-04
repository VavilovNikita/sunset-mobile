import { router } from "expo-router";
import { Body, Button, Card, Label, Screen, Title } from "@sunset/ui";
import { homeEntriesFor } from "../../lib/access";
import { useSession, useSignedIn } from "../../lib/session";
import { NotPrintedBanner } from "../../components/NotPrintedBanner";
import { AppUpdates, versionLabel } from "../../components/AppUpdates";

export default function Home() {
  const { user } = useSignedIn();
  const { signOut } = useSession();
  const functions = user.functions.length ? ` · ${user.functions.join(", ").toLowerCase()}` : "";
  return (
    <Screen>
      <Title>{user.name}</Title>
      <Label>
        {user.role}
        {functions}
      </Label>
      <AppUpdates />
      <NotPrintedBanner />
      {homeEntriesFor(user).map((entry) => (
        <Card key={entry.href} onPress={() => router.push(entry.href as never)}>
          <Body>{entry.label}</Body>
        </Card>
      ))}
      <Button title="Sign out" variant="secondary" onPress={() => void signOut()} />
      <Body muted>{`Version ${versionLabel()}`}</Body>
    </Screen>
  );
}
