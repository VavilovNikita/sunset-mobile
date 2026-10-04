import { useState } from "react";
import { router } from "expo-router";
import { call } from "@sunset/api-client";
import { formatDate, hotelDateKey } from "@sunset/core";
import { Badge, Body, Card, ErrorText, Loading, Row, Screen, colors } from "@sunset/ui";
import { RequireCapability } from "../../components/Guard";
import { DateStepper } from "../../components/DateStepper";
import { overdueLabel } from "../../lib/frontDesk";
import { useLoad } from "../../lib/hooks";
import { useSignedIn } from "../../lib/session";

export default function InHouse() {
  return (
    <RequireCapability capability="frontdesk">
      <InHouseBody />
    </RequireCapability>
  );
}

/** Guests in house on one night, one row per occupied room (GET /reports/in-house). */
function InHouseBody() {
  const { api } = useSignedIn();
  const [date, setDate] = useState(hotelDateKey(new Date()));
  const report = useLoad(() => call(api.GET("/reports/in-house", { params: { query: { date } } }), "Could not load the in-house list."), [api, date]);
  const r = report.data;
  return (
    <Screen>
      <DateStepper value={date} onChange={setDate} />
      <ErrorText>{report.error}</ErrorText>
      {report.loading && !r ? <Loading /> : null}
      {r ? <Body muted>{`${r.total.rooms} room${r.total.rooms === 1 ? "" : "s"} · ${r.total.adults} adults · ${r.total.children} children`}</Body> : null}
      {r?.rooms.length === 0 ? <Body muted>Nobody in house that night.</Body> : null}
      {r?.rooms.map((row) => {
        const overdue = overdueLabel(row.overdueDays);
        return (
          <Card key={`${row.bookingId}-${row.roomUnitLabel ?? ""}`} onPress={() => router.push(`/bookings/${row.bookingId}`)} accent={overdue ? colors.coral : undefined}>
            <Row style={{ justifyContent: "space-between" }}>
              <Body style={{ flex: 1 }}>{row.guestName}</Body>
              <Badge text={row.marketSegment} color={colors.ink3} />
            </Row>
            <Body muted>{`${row.roomName}${row.roomUnitLabel ? ` · ${row.roomUnitLabel}` : ""} · ${formatDate(row.arrival)} → ${formatDate(row.departure)}`}</Body>
            <Body muted>{`${row.adults} adult${row.adults === 1 ? "" : "s"}${row.children ? `, ${row.children} child${row.children === 1 ? "" : "ren"}` : ""}`}</Body>
            {overdue ? <Badge text={overdue} color={colors.coralDeep} /> : null}
          </Card>
        );
      })}
    </Screen>
  );
}
