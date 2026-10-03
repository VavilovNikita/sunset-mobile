import { useState } from "react";
import { Redirect, router } from "expo-router";
import { call } from "@sunset/api-client";
import { formatBaht, formatDateRange } from "@sunset/core";
import { Badge, Body, Button, Card, ErrorText, Field, Label, Loading, Row, Screen, Title, colors } from "@sunset/ui";
import { useAction, useLoad } from "../../lib/hooks";
import { useSession } from "../../lib/session";
import { canOrderRoomService, stayLabel } from "../../lib/stay";

export default function Account() {
  const { ready, account } = useSession();
  if (!ready) return <Loading />;
  if (!account) return <Redirect href="/account/login" />;
  return <AccountBody />;
}

function AccountBody() {
  const { api, account, signOut, acceptToken } = useSession();
  const bookings = useLoad(() => call(api!.GET("/guest/bookings"), "Could not load your bookings."), [api]);
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [changed, setChanged] = useState(false);
  const change = useAction();

  return (
    <Screen>
      <Title>{account?.name ?? account?.email}</Title>
      {account?.name ? <Body muted>{account.email}</Body> : null}
      <ErrorText>{bookings.error}</ErrorText>
      {bookings.loading && !bookings.data ? <Loading /> : null}
      {bookings.data?.length === 0 ? <Body muted>No bookings yet.</Body> : null}
      {(bookings.data ?? []).map((b) => (
        <Card key={b.id} accent={b.occupancyStatus === "CHECKED_IN" ? colors.sea : undefined}>
          <Row style={{ justifyContent: "space-between" }}>
            <Body style={{ flex: 1 }}>{b.roomLabel ? `${b.roomName} · ${b.roomLabel}` : b.roomName}</Body>
            <Badge text={stayLabel(b)} color={b.status === "CANCELLED" ? colors.slate : b.occupancyStatus === "CHECKED_IN" ? colors.sea : colors.ink3} />
          </Row>
          <Body muted>{formatDateRange(b.checkIn, b.checkOut)}</Body>
          <Body muted>{formatBaht(b.totalPrice)}</Body>
          {canOrderRoomService(b) ? <Button title="Order room service" onPress={() => router.push(`/room-service/${b.id}`)} /> : null}
        </Card>
      ))}

      <Label>Change password</Label>
      <Field label="Current password" value={current} onChangeText={setCurrent} secureTextEntry autoComplete="password" />
      <Field label="New password (at least 8 characters)" value={next} onChangeText={setNext} secureTextEntry autoComplete="new-password" />
      <Button
        title="Change password"
        variant="secondary"
        busy={change.busy}
        disabled={!current || next.length < 8}
        onPress={async () => {
          setChanged(false);
          const r = await change.run(() =>
            call(api!.PATCH("/guest/password", { body: { currentPassword: current, newPassword: next } }), "Could not change the password."),
          );
          if (r.ok) {
            // Every other device is signed out (tokenVersion); this one keeps going with the new token.
            await acceptToken(r.data.token, r.data.account);
            setCurrent("");
            setNext("");
            setChanged(true);
          }
        }}
      />
      {changed ? <Body muted>Password changed. Other devices have been signed out.</Body> : null}
      <ErrorText>{change.error}</ErrorText>
      <Button title="Sign out" variant="secondary" onPress={() => void signOut()} />
    </Screen>
  );
}
