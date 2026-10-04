import { useState } from "react";
import { call } from "@sunset/api-client";
import { addDays, formatDate, hotelDateKey } from "@sunset/core";
import { Button, Card, ErrorText, Label, Loading, Row, Screen, Title } from "@sunset/ui";
import { RequireCapability } from "../../../components/Guard";
import { Stat } from "../../../components/ReportBits";
import { percent } from "../../../lib/reports";
import { useLoad } from "../../../lib/hooks";
import { useSignedIn } from "../../../lib/session";

export default function Forecast() {
  return (
    <RequireCapability capability="reports">
      <ForecastBody />
    </RequireCapability>
  );
}

const DAYS = 14;

function ForecastBody() {
  const { api } = useSignedIn();
  const today = hotelDateKey(new Date());
  const [from, setFrom] = useState(today);
  const to = addDays(from, DAYS - 1);
  const report = useLoad(() => call(api.GET("/reports/forecast", { params: { query: { from, to } } }), "Could not load the forecast."), [api, from, to]);
  return (
    <Screen>
      <Title>{`${formatDate(from)} – ${formatDate(to)}`}</Title>
      <Row>
        <Button title="‹ 2 weeks" variant="secondary" disabled={from <= today} onPress={() => setFrom(addDays(from, -DAYS))} />
        <Button title="2 weeks ›" variant="secondary" onPress={() => setFrom(addDays(from, DAYS))} />
      </Row>
      <ErrorText>{report.error}</ErrorText>
      {report.loading && !report.data ? <Loading /> : null}
      {report.data?.days.map((d) => (
        <Card key={d.date}>
          <Label>{formatDate(d.date)}</Label>
          <Stat label="Arrivals · departures" value={`${d.total.arrivals} · ${d.total.departures}`} />
          <Stat label="Occupied · vacant" value={`${d.total.occupied} · ${d.total.vacant}`} />
          <Stat label="Occupancy" value={percent(d.total.occupancyPercent)} />
        </Card>
      ))}
    </Screen>
  );
}
