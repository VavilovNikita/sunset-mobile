import { useState } from "react";
import { View } from "react-native";
import { router } from "expo-router";
import { call } from "@sunset/api-client";
import { addDays, formatDate, hotelDateKey } from "@sunset/core";
import { Badge, Body, Button, Card, ErrorText, Label, Loading, Row, Screen, Title, colors } from "@sunset/ui";
import { RequireCapability } from "../../components/Guard";
import { STATUS_LABELS } from "../../lib/frontDesk";
import { segmentsInRange } from "../../lib/staffBooking";
import { useLoad } from "../../lib/hooks";
import { useSignedIn } from "../../lib/session";

export default function Calendar() {
  return (
    <RequireCapability capability="frontdesk">
      <CalendarBody />
    </RequireCapability>
  );
}

const DAYS = 14;

/**
 * The booking calendar for a phone: two weeks at a time, room by room, as a list of stays (GET
 * /bookings/calendar). Moving and resizing stays is a drag on the web calendar; here a stay opens
 * its booking card.
 */
function CalendarBody() {
  const { api } = useSignedIn();
  const today = hotelDateKey(new Date());
  const [from, setFrom] = useState(today);
  const to = addDays(from, DAYS);
  const cal = useLoad(() => call(api.GET("/bookings/calendar", { params: { query: { from, to } } }), "Could not load the calendar."), [api, from, to]);
  const c = cal.data;

  return (
    <Screen>
      <Title>{`${formatDate(from)} – ${formatDate(addDays(to, -1))}`}</Title>
      <Row>
        <Button title="‹ 2 weeks" variant="secondary" onPress={() => setFrom(addDays(from, -DAYS))} />
        <Button title="Today" variant="secondary" disabled={from === today} onPress={() => setFrom(today)} />
        <Button title="2 weeks ›" variant="secondary" onPress={() => setFrom(addDays(from, DAYS))} />
      </Row>
      <Button title="New booking" onPress={() => router.push("/bookings/new")} />
      <ErrorText>{cal.error}</ErrorText>
      {cal.loading && !c ? <Loading /> : null}
      {c?.roomTypes.map((type) => {
        const ofType = c.bookings.filter((b) => b.roomId === type.roomId && b.status !== "CANCELLED");
        const unassigned = segmentsInRange(ofType.filter((b) => !b.roomUnitId), from, to);
        const minFree = type.dailyAvailable.length ? Math.min(...type.dailyAvailable.map((d) => d.availableCount)) : null;
        return (
          <View key={type.roomId} style={{ gap: 8 }}>
            <Label>{`${type.roomName}${minFree != null ? ` · at least ${minFree} free each night` : ""}`}</Label>
            {type.roomUnits
              .filter((u) => u.isActive)
              .sort((a, b) => a.label.localeCompare(b.label, undefined, { numeric: true }))
              .map((unit) => {
                const stays = segmentsInRange(ofType.filter((b) => b.roomUnitId === unit.id), from, to);
                const blocks = c.blocks.filter((bl) => bl.roomUnitId === unit.id && bl.fromDate < to && bl.toDate >= from);
                return (
                  <Card key={unit.id} accent={blocks.length ? colors.coral : stays.length === 0 ? colors.sea : undefined}>
                    <Body>{`Room ${unit.label}`}</Body>
                    {stays.length === 0 && blocks.length === 0 ? <Body muted>Free these two weeks</Body> : null}
                    {blocks.map((bl) => (
                      <Body key={bl.id} muted>{`Blocked ${formatDate(bl.fromDate)} → ${formatDate(bl.toDate)}: ${bl.reason}`}</Body>
                    ))}
                    {stays.map((s) => (
                      <Row key={s.segmentId} style={{ justifyContent: "space-between" }}>
                        <Body style={{ flex: 1 }} >{`${formatDate(s.checkIn)} → ${formatDate(s.checkOut)} · ${s.guestName}`}</Body>
                        <Button title={s.overstayUntil ? "Overdue" : STATUS_LABELS[s.status]} variant="secondary" onPress={() => router.push(`/bookings/${s.bookingId}`)} />
                      </Row>
                    ))}
                  </Card>
                );
              })}
            {unassigned.length > 0 ? (
              <Card accent={colors.amber}>
                <Body>No room assigned yet</Body>
                {unassigned.map((s) => (
                  <Row key={s.segmentId} style={{ justifyContent: "space-between" }}>
                    <Body style={{ flex: 1 }}>{`${formatDate(s.checkIn)} → ${formatDate(s.checkOut)} · ${s.guestName}`}</Body>
                    <Badge text={STATUS_LABELS[s.status]} color={colors.slate} />
                    <Button title="Open" variant="secondary" onPress={() => router.push(`/bookings/${s.bookingId}`)} />
                  </Row>
                ))}
              </Card>
            ) : null}
          </View>
        );
      })}
    </Screen>
  );
}
