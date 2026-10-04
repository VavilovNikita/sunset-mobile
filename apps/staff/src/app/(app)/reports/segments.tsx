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

const NAMES: Record<Schemas["MarketSegment"], string> = {
  COM: "Complimentary",
  DIR: "Direct",
  HFO: "House use",
  OTA: "Online travel agents",
  OTH: "Other / not recorded",
  WLK: "Walk-in",
};

export default function Segments() {
  return (
    <RequireCapability capability="reports">
      <SegmentsBody />
    </RequireCapability>
  );
}

function SegmentCard({ title, row }: { title: string; row: Schemas["MarketSegmentRow"] }) {
  return (
    <Card>
      <Label>{title}</Label>
      <Stat label="Room-nights" value={`${row.roomNights} (${percent(row.roomNightsPercent)})`} />
      <Stat label="Guests" value={`${row.guests} (${percent(row.guestsPercent)})`} />
      <Stat label="Revenue" value={`${formatBaht(row.revenue)} (${percent(row.revenuePercent)})`} />
      <Stat label="Average rate" value={row.averageRate ? formatBaht(row.averageRate) : "—"} />
    </Card>
  );
}

function SegmentsBody() {
  const { api } = useSignedIn();
  const [ym, setYm] = useState(monthOf(hotelDateKey(new Date())));
  const { from, to } = monthRange(ym);
  const report = useLoad(() => call(api.GET("/reports/market-segment", { params: { query: { from, to } } }), "Could not load segments."), [api, from, to]);
  const r = report.data;
  return (
    <Screen>
      <MonthStepper value={ym} onChange={setYm} />
      <ErrorText>{report.error}</ErrorText>
      {report.loading && !r ? <Loading /> : null}
      {r ? <SegmentCard title="Total" row={r.total} /> : null}
      {r?.segments.map((row) => <SegmentCard key={row.segment} title={`${NAMES[row.segment]} (${row.segment})`} row={row} />)}
    </Screen>
  );
}
