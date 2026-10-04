import { useState } from "react";
import { View } from "react-native";
import { call } from "@sunset/api-client";
import { formatClock, hotelDateKey } from "@sunset/core";
import { Badge, Body, Card, ErrorText, Label, Loading, Row, Screen, colors } from "@sunset/ui";
import { RequireCapability } from "../../../components/Guard";
import { DateStepper } from "../../../components/DateStepper";
import { useLoad } from "../../../lib/hooks";
import { useSignedIn } from "../../../lib/session";

export default function RosterDay() {
  return (
    <RequireCapability capability="settings.manage">
      <RosterBody />
    </RequireCapability>
  );
}

const hours = (c: { startTime1?: string | null; endTime1?: string | null; startTime2?: string | null; endTime2?: string | null }) =>
  [c.startTime1 && c.endTime1 ? `${formatClock(c.startTime1)}–${formatClock(c.endTime1)}` : null, c.startTime2 && c.endTime2 ? `${formatClock(c.startTime2)}–${formatClock(c.endTime2)}` : null]
    .filter(Boolean)
    .join(" / ");

/** One day of the roster (GET /roster for its month), by area, with the server's coverage warnings. Editing stays on the web grid. */
function RosterBody() {
  const { api } = useSignedIn();
  const [date, setDate] = useState(hotelDateKey(new Date()));
  const year = Number(date.slice(0, 4));
  const month = Number(date.slice(5, 7));
  const roster = useLoad(() => call(api.GET("/roster", { params: { query: { year, month } } }), "Could not load the roster."), [api, year, month]);
  const r = roster.data;
  const entries = (r?.entries ?? []).filter((e) => e.date === date);
  const areaOf = (userId: string) => r?.employees.find((e) => e.id === userId)?.staffArea ?? "OTHER";
  const areas = [...new Set(entries.map((e) => areaOf(e.employeeUserId)))].sort();
  const warnings = (r?.coverageWarnings ?? []).filter((w) => w.date === date);

  return (
    <Screen>
      <DateStepper value={date} onChange={setDate} />
      <ErrorText>{roster.error}</ErrorText>
      {roster.loading && !r ? <Loading /> : null}
      {warnings.map((w) => (
        <Card key={w.staffArea} accent={colors.coral}>
          <Body>{`${w.staffArea.replace("_", " ").toLowerCase()}: ${w.workingCount} working, at least ${w.minimumWorking} needed`}</Body>
        </Card>
      ))}
      {r && entries.length === 0 ? <Body muted>Nothing rostered for this day.</Body> : null}
      {areas.map((area) => (
        <View key={area} style={{ gap: 8 }}>
          <Label>{area.replace("_", " ")}</Label>
          {entries
            .filter((e) => areaOf(e.employeeUserId) === area)
            .sort((a, b) => (a.shiftCode.startTime1 ?? "99").localeCompare(b.shiftCode.startTime1 ?? "99"))
            .map((e) => (
              <Card key={e.id}>
                <Row style={{ justifyContent: "space-between" }}>
                  <Body style={{ flex: 1 }}>{e.employeeName}</Body>
                  <Badge text={e.shiftCode.code} color={e.shiftCode.displayColor ?? colors.slate} />
                </Row>
                {hours(e.shiftCode) ? <Body muted>{hours(e.shiftCode)}</Body> : null}
                {e.note ? <Body muted>{e.note}</Body> : null}
              </Card>
            ))}
        </View>
      ))}
      <Body muted>Changing the roster is done on the web grid.</Body>
    </Screen>
  );
}
