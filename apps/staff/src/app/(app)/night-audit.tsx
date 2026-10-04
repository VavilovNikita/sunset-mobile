import { useState } from "react";
import { View } from "react-native";
import { router } from "expo-router";
import { call } from "@sunset/api-client";
import type { Schemas } from "@sunset/api-client/staff";
import { addDays, formatBaht, formatDate, formatTimestamp, hotelDateKey } from "@sunset/core";
import { Body, Button, Card, ErrorText, Field, Label, Loading, Row, Screen, colors } from "@sunset/ui";
import { RequireCapability } from "../../components/Guard";
import { DateStepper } from "../../components/DateStepper";
import { ask } from "../../lib/ask";
import { useAction, useLoad } from "../../lib/hooks";
import { useSignedIn } from "../../lib/session";

export default function NightAudit() {
  return (
    <RequireCapability capability="frontdesk">
      <NightAuditBody />
    </RequireCapability>
  );
}

function Missed({ title, rows, empty }: { title: string; rows: Schemas["NightAuditBooking"][]; empty: string }) {
  return (
    <View style={{ gap: 8 }}>
      <Label>{`${title} (${rows.length})`}</Label>
      {rows.length === 0 ? <Body muted>{empty}</Body> : null}
      {rows.map((b) => (
        <Card key={b.id} accent={colors.coral} onPress={() => router.push(`/bookings/${b.id}`)}>
          <Body>{b.guestName}</Body>
          <Body muted>{`${b.roomName}${b.roomUnitLabel ? ` · ${b.roomUnitLabel}` : ""} · ${formatDate(b.checkIn)} → ${formatDate(b.checkOut)}`}</Body>
        </Card>
      ))}
    </View>
  );
}

/** The night-audit checklist for one hotel date, and closing it (GET /night-audit, POST /night-audit/close). */
function NightAuditBody() {
  const { api } = useSignedIn();
  // The audit is normally done for the night that just ended.
  const [date, setDate] = useState(addDays(hotelDateKey(new Date()), -1));
  const audit = useLoad(() => call(api.GET("/night-audit", { params: { query: { date } } }), "Could not load the night audit."), [api, date]);
  const [notes, setNotes] = useState("");
  const close = useAction();
  const a = audit.data;

  async function doClose() {
    const r = await close.run(() => call(api.POST("/night-audit/close", { body: { date, notes: notes.trim() || null } }), "Could not close the date."));
    if (r.ok && a) {
      audit.apply({ ...a, closure: r.data });
      setNotes("");
    }
  }

  return (
    <Screen>
      <DateStepper value={date} onChange={setDate} />
      <ErrorText>{audit.error}</ErrorText>
      {audit.loading && !a ? <Loading /> : null}
      {a ? (
        <>
          <Missed title="Missed arrivals" rows={a.missedArrivals} empty="Every arrival was checked in or marked." />
          <Missed title="Missed departures" rows={a.missedDepartures} empty="Every departure was checked out." />
          <Card>
            <Label>The night in numbers</Label>
            <Row style={{ justifyContent: "space-between" }}>
              <Body muted>Rooms sold / available</Body>
              <Body>{`${a.snapshot.roomNightsSold} / ${a.snapshot.roomNightsAvailable}`}</Body>
            </Row>
            <Row style={{ justifyContent: "space-between" }}>
              <Body muted>Occupancy</Body>
              <Body>{a.snapshot.occupancyPercent != null ? `${a.snapshot.occupancyPercent}%` : "—"}</Body>
            </Row>
            <Row style={{ justifyContent: "space-between" }}>
              <Body muted>Room revenue</Body>
              <Body>{formatBaht(a.snapshot.roomRevenue)}</Body>
            </Row>
            <Row style={{ justifyContent: "space-between" }}>
              <Body muted>ADR · RevPAR</Body>
              <Body>{`${a.snapshot.adr != null ? formatBaht(a.snapshot.adr) : "—"} · ${a.snapshot.revpar != null ? formatBaht(a.snapshot.revpar) : "—"}`}</Body>
            </Row>
          </Card>
          {a.closure ? (
            <Card accent={colors.green}>
              <Body>{`Closed by ${a.closure.closedByName}, ${formatTimestamp(a.closure.closedAt)}`}</Body>
              {a.closure.notes ? <Body muted>{a.closure.notes}</Body> : null}
            </Card>
          ) : (
            <Card>
              <Label>Close this date</Label>
              <Field label="Notes (optional)" value={notes} onChangeText={setNotes} multiline />
              <Button
                title="Close date"
                busy={close.busy}
                onPress={() =>
                  ask("Close the night audit", `Record that ${formatDate(date)} was reviewed?${a.missedArrivals.length + a.missedDepartures.length > 0 ? " There are still missed arrivals or departures." : ""}`, [
                    { text: "Back", style: "cancel" },
                    { text: "Close date", onPress: () => void doClose() },
                  ])
                }
              />
              <ErrorText>{close.error}</ErrorText>
            </Card>
          )}
        </>
      ) : null}
    </Screen>
  );
}
