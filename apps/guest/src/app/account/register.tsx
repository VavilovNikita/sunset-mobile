import { useState } from "react";
import { router } from "expo-router";
import { call } from "@sunset/api-client";
import { Body, Button, ErrorText, Field, Screen } from "@sunset/ui";
import { useAction } from "../../lib/hooks";
import { useApi } from "../../lib/session";

export default function Register() {
  const api = useApi();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [sent, setSent] = useState<string | null>(null);
  const submit = useAction();

  if (sent) {
    return (
      <Screen>
        <Body>{sent}</Body>
        <Body muted>Open the link in the email to verify your address, then sign in here.</Body>
        <Button title="Go to sign in" onPress={() => router.replace("/account/login")} />
      </Screen>
    );
  }

  return (
    <Screen>
      <Field label="Name (optional)" value={name} onChangeText={setName} autoComplete="name" />
      <Field label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoComplete="email" />
      <Field label="Password (at least 8 characters)" value={password} onChangeText={setPassword} secureTextEntry autoComplete="new-password" textContentType="newPassword" />
      <Button
        title="Create account"
        busy={submit.busy}
        disabled={!email.trim() || password.length < 8}
        onPress={async () => {
          const r = await submit.run(() =>
            call(api.POST("/guest-auth/register", { body: { email: email.trim(), password, name: name.trim() || null } }), "Could not create the account."),
          );
          if (r.ok) setSent(r.data.message);
        }}
      />
      <ErrorText>{submit.error}</ErrorText>
    </Screen>
  );
}
