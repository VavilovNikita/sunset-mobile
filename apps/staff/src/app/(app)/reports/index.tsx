import { router } from "expo-router";
import { Body, Card, Screen } from "@sunset/ui";
import { RequireCapability } from "../../../components/Guard";

const REPORTS = [
  { href: "/reports/manager", label: "Manager report", hint: "One night against the same night last year" },
  { href: "/reports/occupancy", label: "Occupancy", hint: "Occupancy, ADR and RevPAR by room type, per month" },
  { href: "/reports/segments", label: "Market segments", hint: "Room-nights, guests and revenue by segment" },
  { href: "/reports/sales", label: "POS sales", hint: "What the restaurant, bar and spa sold" },
  { href: "/reports/forecast", label: "Forecast", hint: "Arrivals, departures and occupancy ahead" },
  { href: "/history", label: "History", hint: "Who did what, from the audit log" },
];

export default function Reports() {
  return (
    <RequireCapability capability="reports">
      <Screen>
        {REPORTS.map((r) => (
          <Card key={r.href} onPress={() => router.push(r.href as never)}>
            <Body>{r.label}</Body>
            <Body muted>{r.hint}</Body>
          </Card>
        ))}
      </Screen>
    </RequireCapability>
  );
}
