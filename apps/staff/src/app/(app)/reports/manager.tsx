import { useState } from "react";
import { call } from "@sunset/api-client";
import type { Schemas } from "@sunset/api-client/staff";
import { addDays, formatBaht, formatDate, hotelDateKey } from "@sunset/core";
import { Body, Card, ErrorText, Label, Loading, Row, Screen } from "@sunset/ui";
import { RequireCapability } from "../../../components/Guard";
import { DateStepper } from "../../../components/DateStepper";
import { percent } from "../../../lib/reports";
import { useLoad } from "../../../lib/hooks";
import { useSignedIn } from "../../../lib/session";

export default function ManagerReport() {
  return (
    <RequireCapability capability="reports">
      <Body_ />
    </RequireCapability>
  );
}

type Day = Schemas["ManagerReportDay"];
type Line = [string, (d: Day) => string];

const SECTIONS: { title: string; lines: Line[] }[] = [
  {
    title: "Rooms",
    lines: [
      ["Available for sale", (d) => String(d.rooms.availableForSale)],
      ["Occupied", (d) => String(d.rooms.occupied)],
      ["Complimentary · house use", (d) => `${d.rooms.complimentary} · ${d.rooms.houseUse}`],
      ["Out of order", (d) => String(d.rooms.outOfOrder)],
      ["Occupancy", (d) => percent(d.rooms.occupancyPercent)],
      ["ADR", (d) => (d.rooms.averageRatePerOccupiedRoom ? formatBaht(d.rooms.averageRatePerOccupiedRoom) : "—")],
      ["RevPAR", (d) => (d.rooms.averageRevenuePerAvailableRoom ? formatBaht(d.rooms.averageRevenuePerAvailableRoom) : "—")],
    ],
  },
  {
    title: "Guests",
    lines: [
      ["In house", (d) => `${d.guests.guestsInHouse} (${d.guests.adultsInHouse} + ${d.guests.childrenInHouse})`],
      ["Per room", (d) => d.guests.averageGuestsPerRoom ?? "—"],
      ["Average stay (nights)", (d) => d.guests.averageLengthOfStay ?? "—"],
    ],
  },
  {
    title: "Movements",
    lines: [
      ["Arrivals · departures", (d) => `${d.accounts.arrivals} · ${d.accounts.departures}`],
      ["Cancellations · no-shows", (d) => `${d.accounts.cancellations} · ${d.accounts.noShows}`],
      ["Walk-in rooms", (d) => String(d.accounts.walkInRooms)],
    ],
  },
  {
    title: "Revenue",
    lines: [
      ["Room revenue", (d) => formatBaht(d.revenue.roomRevenue)],
      ["Per in-house guest", (d) => (d.revenue.averageRevenuePerInHouseGuest ? formatBaht(d.revenue.averageRevenuePerInHouseGuest) : "—")],
    ],
  },
  {
    title: "Tomorrow",
    lines: [
      ["Arrivals · departures", (d) => `${d.tomorrow.arrivals} · ${d.tomorrow.departures}`],
      ["Occupied", (d) => `${d.tomorrow.occupied} of ${d.tomorrow.availableForSale}`],
      ["Occupancy", (d) => percent(d.tomorrow.occupancyPercent)],
    ],
  },
];

/** GET /reports/manager - every figure is the server's; the phone only lays them side by side. */
function Body_() {
  const { api } = useSignedIn();
  const [date, setDate] = useState(addDays(hotelDateKey(new Date()), -1));
  const report = useLoad(() => call(api.GET("/reports/manager", { params: { query: { date } } }), "Could not load the report."), [api, date]);
  const r = report.data;
  return (
    <Screen>
      <DateStepper value={date} onChange={setDate} />
      <ErrorText>{report.error}</ErrorText>
      {report.loading && !r ? <Loading /> : null}
      {r ? <Body muted>{`Compared with ${formatDate(r.lastYearDate)}`}</Body> : null}
      {r
        ? SECTIONS.map((section) => (
            <Card key={section.title}>
              <Label>{section.title}</Label>
              {section.lines.map(([label, get]) => (
                <Row key={label} style={{ justifyContent: "space-between" }}>
                  <Body muted style={{ flex: 1 }}>{label}</Body>
                  <Body>{get(r.today)}</Body>
                  <Body muted style={{ width: 90, textAlign: "right" }}>{get(r.lastYear)}</Body>
                </Row>
              ))}
            </Card>
          ))
        : null}
    </Screen>
  );
}
