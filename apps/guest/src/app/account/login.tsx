import { useState } from "react";
import { router } from "expo-router";
import { call } from "@sunset/api-client";
import { Body, Button, ErrorText, Field, Screen } from "@sunset/ui";
import { useAction } from "../../lib/hooks";
import { useApi, useSession } from "../../lib/session";

export default function Login() {
  const api = useApi();
  const { signIn, notice } = useSession();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [unverified, setUnverified] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const submit = useAction();
  const resend = useAction();

  return (
    <Screen>
      {notice ? <Body muted>{notice}</Body> : null}
      <Field label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoComplete="email" textContentType="username" />
      <Field label="Password" value={password} onChangeText={setPassword} secureTextEntry autoComplete="password" textContentType="password" />
      <Button
        title="Sign in"
        busy={submit.busy}
        disabled={!email.trim() || !password}
        onPress={async () => {
          setUnverified(false);
          const r = await submit.run(() => signIn(email, password));
          if (r.ok) router.replace("/account");
          // 403 = right password, email not verified yet: say so and offer the link again.
          else if (r.status === 403) setUnverified(true);
        }}
      />
      <ErrorText>{submit.error}</ErrorText>
      {unverified ? (
        <Button
          title="Email me the verification link again"
          variant="secondary"
          busy={resend.busy}
          onPress={async () => {
            const r = await resend.run(() => call(api.POST("/guest-auth/resend-verification", { body: { email: email.trim() } }), "Could not send the email."));
            if (r.ok) setMessage(r.data.message);
          }}
        />
      ) : null}
      {message ? <Body muted>{message}</Body> : null}
      <ErrorText>{resend.error}</ErrorText>
      <Button title="Forgot password?" variant="secondary" onPress={() => router.push("/account/forgot")} />
      <Button title="Create an account" variant="secondary" onPress={() => router.push("/account/register")} />
    </Screen>
  );
}
