import { useState } from "react";
import { router } from "expo-router";
import { call } from "@sunset/api-client";
import type { Schemas } from "@sunset/api-client/staff";
import { Badge, Body, Button, Card, ErrorText, Field, Loading, Row, Screen, colors } from "@sunset/ui";
import { RequireCapability } from "../../../components/Guard";
import { useLoad } from "../../../lib/hooks";
import { useSignedIn } from "../../../lib/session";

export default function Guests() {
  return (
    <RequireCapability capability="frontdesk">
      <GuestsBody />
    </RequireCapability>
  );
}

function GuestsBody() {
  const { api } = useSignedIn();
  const [typed, setTyped] = useState("");
  const [q, setQ] = useState("");
  const guests = useLoad(
    async () => (q ? call(api.GET("/guests", { params: { query: { q } } }), "Could not search guests.") : { ok: true as const, data: [] as Schemas["Guest"][], status: 200 }),
    [api, q],
  );
  return (
    <Screen>
      <Field label="Name, email or phone" value={typed} onChangeText={setTyped} onSubmitEditing={() => setQ(typed.trim())} returnKeyType="search" autoCapitalize="none" />
      <Button title="Search" variant="secondary" disabled={!typed.trim()} onPress={() => setQ(typed.trim())} />
      <ErrorText>{guests.error}</ErrorText>
      {q && guests.loading ? <Loading /> : null}
      {!q ? <Body muted>Search for a guest to see their card and stays.</Body> : null}
      {q && !guests.loading && guests.data?.length === 0 ? <Body muted>No guest matches.</Body> : null}
      {guests.data?.map((g) => (
        <Card key={g.id} onPress={() => router.push(`/guests/${g.id}`)}>
          <Row style={{ justifyContent: "space-between" }}>
            <Body style={{ flex: 1 }}>{g.name}</Body>
            {g.vip ? <Badge text="VIP" color={colors.amber} /> : null}
          </Row>
          <Body muted>{[g.email, g.phone].filter(Boolean).join(" · ") || "No contact details"}</Body>
        </Card>
      ))}
    </Screen>
  );
}
