import type { ReactNode } from "react";
import { Body, Button, Row, Title } from "@sunset/ui";
import { monthLabel, shiftMonth, type YearMonth } from "../lib/reports";

/** One figure: label on the left, the server's value on the right. */
export function Stat({ label, value, sub }: { label: string; value: ReactNode; sub?: ReactNode }) {
  return (
    <Row style={{ justifyContent: "space-between" }}>
      <Body muted style={{ flex: 1 }}>{label}</Body>
      <Body>{value}</Body>
      {sub != null ? <Body muted>{sub}</Body> : null}
    </Row>
  );
}

export function MonthStepper({ value, onChange }: { value: YearMonth; onChange: (v: YearMonth) => void }) {
  return (
    <>
      <Title>{monthLabel(value)}</Title>
      <Row>
        <Button title="‹ Prev" variant="secondary" onPress={() => onChange(shiftMonth(value, -1))} />
        <Button title="Next ›" variant="secondary" onPress={() => onChange(shiftMonth(value, 1))} />
      </Row>
    </>
  );
}
