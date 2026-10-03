import { useState } from "react";
import { Redirect } from "expo-router";
import { Body, Button, ErrorText, Field, Screen, Title } from "@sunset/ui";
import { useSession } from "../lib/session";

export default function Login() {
  const { status, signIn, notice } = useSession();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (status === "signedIn") return <Redirect href="/" />;

  async function submit() {
    setBusy(true);
    setError(null);
    const result = await signIn(email, password);
    setBusy(false);
    if (!result.ok) setError(result.status === 401 ? "Invalid email or password." : result.error);
  }

  return (
    <Screen>
      <Title>Sunset Beach — Staff</Title>
      {notice ? <Body muted>{notice}</Body> : null}
      <Field label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" autoComplete="email" keyboardType="email-address" textContentType="username" />
      <Field label="Password" value={password} onChangeText={setPassword} secureTextEntry autoComplete="password" textContentType="password" onSubmitEditing={submit} />
      <Button title="Sign in" onPress={submit} busy={busy} disabled={!email.trim() || !password} />
      <ErrorText>{error}</ErrorText>
    </Screen>
  );
}
