import { addDays, formatDate, hotelDateKey } from "@sunset/core";
import { Button, Row, Title } from "@sunset/ui";
import { View } from "react-native";

/** Day navigation without a date library: keys are stepped in UTC, "today" is the hotel's day. */
export function DateStepper({ value, onChange }: { value: string; onChange: (key: string) => void }) {
  const today = hotelDateKey(new Date());
  return (
    <View style={{ gap: 8 }}>
      <Title>{value === today ? `Today · ${formatDate(value)}` : formatDate(value)}</Title>
      <Row>
        <Button title="‹ Prev" variant="secondary" onPress={() => onChange(addDays(value, -1))} />
        <Button title="Today" variant="secondary" disabled={value === today} onPress={() => onChange(today)} />
        <Button title="Next ›" variant="secondary" onPress={() => onChange(addDays(value, 1))} />
      </Row>
    </View>
  );
}
