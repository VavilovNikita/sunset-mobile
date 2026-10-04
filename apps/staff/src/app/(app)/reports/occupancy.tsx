import { useState } from "react";
import { call } from "@sunset/api-client";
import type { Schemas } from "@sunset/api-client/staff";
import { formatBaht, hotelDateKey } from "@sunset/core";
import { Card, ErrorText, Label, Loading, Screen } from "@sunset/ui";
import { RequireCapability } from "../../../components/Guard";
import { MonthStepper, Stat } from "../../../components/ReportBits";
import { monthOf, monthRange, percent } from "../../../lib/reports";
import { useLoad } from "../../../lib/hooks";
import { useSignedIn } from "../../../lib/session";

export default function Occupancy() {
  return (
    <RequireCapability capability="reports">
      <OccupancyBody />
    </RequireCapability>
  );
}

function RowCard({ title, row }: { title: string; row: Schemas["OccupancyReportRow"] }) {
  return (
    <Card>
      <Label>{title}</Label>
      <Stat label="Room-nights sold / available" value={`${row.roomNightsSold} / ${row.roomNightsAvailable}`} />
      <Stat label="Occupancy" value={percent(row.occupancyPercent)} />
      <Stat label="Room revenue" value={formatBaht(row.roomRevenue)} />
      <Stat label="ADR" value={row.adr ? formatBaht(row.adr) : "—"} />
      <Stat label="RevPAR" value={row.revpar ? formatBaht(row.revpar) : "—"} />
    </Card>
  );
}

function OccupancyBody() {
  const { api } = useSignedIn();
  const [ym, setYm] = useState(monthOf(hotelDateKey(new Date())));
  const { from, to } = monthRange(ym);
  const report = useLoad(() => call(api.GET("/reports/occupancy", { params: { query: { from, to } } }), "Could not load occupancy."), [api, from, to]);
  const r = report.data;
  return (
    <Screen>
      <MonthStepper value={ym} onChange={setYm} />
      <ErrorText>{report.error}</ErrorText>
      {report.loading && !r ? <Loading /> : null}
      {r ? <RowCard title="All rooms" row={r.total} /> : null}
      {r?.rooms.map((row) => <RowCard key={row.roomId ?? row.roomName ?? "?"} title={row.roomName ?? "Room"} row={row} />)}
    </Screen>
  );
}
