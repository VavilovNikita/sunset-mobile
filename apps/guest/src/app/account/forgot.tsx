import { useState } from "react";
import { router } from "expo-router";
import { call } from "@sunset/api-client";
import { Body, Button, ErrorText, Field, Label, Screen } from "@sunset/ui";
import { useAction } from "../../lib/hooks";
import { useApi, useSession } from "../../lib/session";
import { resetTokenFrom } from "../../lib/resetLink";

/**
 * Both halves of POST /guest-auth/forgot-password + /reset-password. The email's link opens the
 * website's reset page, which works from any device; pasting that link here finishes the reset in
 * the app instead.
 */
export default function Forgot() {
  const api = useApi();
  const { acceptToken } = useSession();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState<string | null>(null);
  const [link, setLink] = useState("");
  const [password, setPassword] = useState("");
  const request = useAction();
  const reset = useAction();
  const token = resetTokenFrom(link);

  return (
    <Screen>
      <Field label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoComplete="email" />
      <Button
        title="Email me a reset link"
        busy={request.busy}
        disabled={!email.trim()}
        onPress={async () => {
          const r = await request.run(() => call(api.POST("/guest-auth/forgot-password", { body: { email: email.trim() } }), "Could not send the email."));
          if (r.ok) setSent(r.data.message);
        }}
      />
      <ErrorText>{request.error}</ErrorText>
      {sent ? <Body>{sent}</Body> : null}

      <Label>Already have the email?</Label>
      <Body muted>Open the link (it works in any browser), or paste it here to finish in the app.</Body>
      <Field label="Reset link from the email" value={link} onChangeText={setLink} autoCapitalize="none" autoCorrect={false} />
      <Field label="New password (at least 8 characters)" value={password} onChangeText={setPassword} secureTextEntry autoComplete="new-password" textContentType="newPassword" />
      <Button
        title="Set new password"
        busy={reset.busy}
        disabled={!token || password.length < 8}
        onPress={async () => {
          if (!token) return;
          const r = await reset.run(() => call(api.POST("/guest-auth/reset-password", { body: { token, newPassword: password } }), "Could not reset the password."));
          if (r.ok) {
            await acceptToken(r.data.token, r.data.account);
            router.replace("/account");
          }
        }}
      />
      {link.trim() && !token ? <ErrorText>That doesn't look like the link from the email.</ErrorText> : null}
      <ErrorText>{reset.error}</ErrorText>
    </Screen>
  );
}
