import { useState } from "react";
import { call } from "@sunset/api-client";
import { formatClock, formatDate, hotelDateKey } from "@sunset/core";
import { Badge, Body, Button, Card, ErrorText, Label, Loading, Row, Screen, Title, colors } from "@sunset/ui";
import { RequireCapability } from "../../components/Guard";
import { can } from "../../lib/access";
import { useLoad } from "../../lib/hooks";
import { useSignedIn } from "../../lib/session";

/** "09:00–18:00" or a split "07:00–14:00 / 18:00–21:00"; empty for a code with no hours (day off, OP). */
function shiftHours(code: { startTime1?: string | null; endTime1?: string | null; startTime2?: string | null; endTime2?: string | null }): string {
  const part = (a?: string | null, b?: string | null) => (a && b ? `${formatClock(a)}–${formatClock(b)}` : null);
  return [part(code.startTime1, code.endTime1), part(code.startTime2, code.endTime2)].filter(Boolean).join(" / ");
}

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export default function Roster() {
  return (
    <RequireCapability capability="roster.mine">
      <RosterBody />
    </RequireCapability>
  );
}

function RosterBody() {
  const { api, user } = useSignedIn();
  const today = hotelDateKey(new Date());
  const [ym, setYm] = useState({ year: Number(today.slice(0, 4)), month: Number(today.slice(5, 7)) });
  const roster = useLoad(
    () => call(api.GET("/roster/me", { params: { query: { year: ym.year, month: ym.month } } }), "Could not load your schedule."),
    [api, ym.year, ym.month],
  );
  const shiftMonth = (delta: number) =>
    setYm(({ year, month }) => {
      const m = month + delta;
      return m < 1 ? { year: year - 1, month: 12 } : m > 12 ? { year: year + 1, month: 1 } : { year, month: m };
    });

  return (
    <Screen>
      <Title>{`${MONTHS[ym.month - 1]} ${ym.year}`}</Title>
      <Row>
        <Button title="‹ Prev" variant="secondary" onPress={() => shiftMonth(-1)} />
        <Button title="Next ›" variant="secondary" onPress={() => shiftMonth(1)} />
      </Row>
      <ErrorText>{roster.error}</ErrorText>
      {roster.loading && !roster.data ? <Loading /> : null}
      {roster.data?.length === 0 ? <Body muted>Nothing scheduled this month - days without an entry are days off.</Body> : null}
      {(roster.data ?? [])
        .slice()
        .sort((a, b) => a.date.localeCompare(b.date))
        .map((entry) => (
          <Card key={entry.id} accent={entry.date === today ? colors.sea : undefined}>
            <Row style={{ justifyContent: "space-between" }}>
              <Body>{formatDate(entry.date)}</Body>
              <Badge text={entry.shiftCode.code} color={entry.shiftCode.displayColor ?? colors.slate} />
            </Row>
            {shiftHours(entry.shiftCode) ? <Body muted>{shiftHours(entry.shiftCode)}</Body> : null}
            {entry.note ? <Body muted>{entry.note}</Body> : null}
          </Card>
        ))}
      {can(user, "attendance.today") ? <AttendanceToday /> : null}
    </Screen>
  );
}

/** Who's on shift right now, from the fingerprint punches - MANAGER+, same floor as the rest of attendance. */
function AttendanceToday() {
  const { api } = useSignedIn();
  const today = useLoad(() => call(api.GET("/attendance/today"), "Could not load attendance."), [api], { pollMs: 60_000 });
  return (
    <Card>
      <Label>On shift today</Label>
      <ErrorText>{today.error}</ErrorText>
      {today.loading && !today.data ? <Loading /> : null}
      {today.data?.length === 0 ? <Body muted>Nobody is rostered today.</Body> : null}
      {(today.data ?? []).map((row) => (
        <Row key={row.employeeUserId} style={{ justifyContent: "space-between" }}>
          <Body style={{ flex: 1 }}>{row.employeeName}</Body>
          <Badge text={row.state.replace(/_/g, " ").toLowerCase()} color={row.state === "LATE" || row.state === "MISSED" ? colors.coral : colors.slate} />
        </Row>
      ))}
    </Card>
  );
}
