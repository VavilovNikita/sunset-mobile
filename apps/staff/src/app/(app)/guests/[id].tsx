import { View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { call } from "@sunset/api-client";
import { formatDate } from "@sunset/core";
import { Badge, Body, Button, Card, ErrorText, Label, Loading, Row, Screen, Title, colors } from "@sunset/ui";
import { RequireCapability } from "../../../components/Guard";
import { BookingRow } from "../../../components/BookingRow";
import { useLoad } from "../../../lib/hooks";
import { useSignedIn } from "../../../lib/session";

export default function GuestCard() {
  return (
    <RequireCapability capability="frontdesk">
      <GuestBody />
    </RequireCapability>
  );
}

/** A guest's card with every stay (GET /guests/{id}). Editing the card stays on the web admin. */
function GuestBody() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { api } = useSignedIn();
  const guest = useLoad(() => call(api.GET("/guests/{id}", { params: { path: { id } } }), "Could not load the guest."), [api, id]);
  if (guest.loading && !guest.data) return <Loading />;
  const g = guest.data;
  if (!g) {
    return (
      <Screen>
        <ErrorText>{guest.error ?? "Guest not found."}</ErrorText>
        <Button title="Try again" onPress={() => void guest.reload()} />
      </Screen>
    );
  }
  const stays = [...g.bookings].sort((a, b) => b.checkIn.localeCompare(a.checkIn));
  return (
    <Screen>
      <Title>{g.name}</Title>
      <Card>
        <Row style={{ flexWrap: "wrap" }}>
          {g.vip ? <Badge text="VIP" color={colors.amber} /> : null}
          {g.tags.map((t) => (
            <Badge key={t} text={t} color={colors.ink3} />
          ))}
          {g.account ? <Badge text={g.account.emailVerified ? "App account" : "App account (unverified)"} color={colors.slate} /> : null}
        </Row>
        {g.email ? <Body muted>{g.email}</Body> : null}
        {g.phone ? <Body muted>{g.phone}</Body> : null}
        {g.dateOfBirth ? <Body muted>{`Born ${formatDate(g.dateOfBirth)}`}</Body> : null}
        {g.notes ? <Body>{g.notes}</Body> : null}
      </Card>
      <View style={{ gap: 8 }}>
        <Label>{`Stays (${stays.length})`}</Label>
        {stays.length === 0 ? <Body muted>No stays yet.</Body> : null}
        {stays.map((b) => (
          <BookingRow key={b.id} booking={b} />
        ))}
      </View>
    </Screen>
  );
}
