import { View } from "react-native";
import { router } from "expo-router";
import { call } from "@sunset/api-client";
import type { Schemas } from "@sunset/api-client/staff";
import { formatBaht, formatDate, isPositiveAmount } from "@sunset/core";
import { Badge, Body, Card, ErrorText, Label, Loading, Row, Screen, colors } from "@sunset/ui";
import { RequireCapability } from "../../components/Guard";
import { OCCUPANCY_LABELS, overdueLabel } from "../../lib/frontDesk";
import { useLoad } from "../../lib/hooks";
import { useSignedIn } from "../../lib/session";

type Unit = Schemas["PropertyMapUnit"];

export default function RoomsMap() {
  return (
    <RequireCapability capability="frontdesk">
      <RoomsBody />
    </RequireCapability>
  );
}

/**
 * The property map as a list: every room's state at a glance (GET /property-map). Colour meanings
 * as on the web: sea = free, coral = needs intervention (blocked, overdue), sand = not cleaned,
 * amber = attention (balance owed), dimmed = out of service.
 */
function accentFor(u: Unit): string | undefined {
  if (!u.isActive) return colors.ink3;
  if (u.activeBlock || (u.currentBooking?.overdueDays ?? 0) > 0) return colors.coral;
  if (u.currentBooking && isPositiveAmount(u.currentBooking.outstandingBalance)) return colors.amber;
  if (u.housekeepingStatus === "DIRTY") return colors.sand;
  if (!u.currentBooking) return colors.sea;
  return undefined;
}

function RoomsBody() {
  const { api } = useSignedIn();
  const map = useLoad(() => call(api.GET("/property-map"), "Could not load the rooms."), [api], { pollMs: 30_000 });
  const units = map.data?.units ?? [];
  const types = [...new Set(units.map((u) => u.roomName))];
  return (
    <Screen>
      <ErrorText>{map.error}</ErrorText>
      {map.loading && !map.data ? <Loading /> : null}
      {map.data && units.length === 0 ? <Body muted>No rooms are set up.</Body> : null}
      {types.map((type) => (
        <View key={type} style={{ gap: 8 }}>
          <Label>{type}</Label>
          {units
            .filter((u) => u.roomName === type)
            .map((u) => {
              const c = u.currentBooking;
              const overdue = overdueLabel(c?.overdueDays);
              return (
                <Card key={u.roomUnitId} accent={accentFor(u)} onPress={c ? () => router.push(`/bookings/${c.bookingId}`) : undefined}>
                  <Row style={{ justifyContent: "space-between" }}>
                    <Body>{`Room ${u.unitLabel}`}</Body>
                    <Row>
                      {!u.isActive ? <Badge text="Out of service" color={colors.ink3} /> : null}
                      <Badge text={u.housekeepingStatus === "DIRTY" ? "Not cleaned" : "Clean"} color={u.housekeepingStatus === "DIRTY" ? colors.sand : colors.sea} />
                    </Row>
                  </Row>
                  {c ? <Body muted>{`${c.guestName} · ${OCCUPANCY_LABELS[c.occupancyStatus]} · out ${formatDate(c.checkOut)}`}</Body> : <Body muted>Free</Body>}
                  {overdue ? <Badge text={overdue} color={colors.coralDeep} /> : null}
                  {c && isPositiveAmount(c.outstandingBalance) ? <Badge text={`Owes ${formatBaht(c.outstandingBalance)}`} color={colors.amber} /> : null}
                  {u.activeBlock ? <Body muted>{`Blocked ${formatDate(u.activeBlock.fromDate)} → ${formatDate(u.activeBlock.toDate)}: ${u.activeBlock.reason}`}</Body> : null}
                  {u.openMaintenanceTask ? <Body muted>{`Maintenance: ${u.openMaintenanceTask.description}`}</Body> : null}
                </Card>
              );
            })}
        </View>
      ))}
    </Screen>
  );
}
