import { router } from "expo-router";
import { formatBaht, formatDate, isPositiveAmount } from "@sunset/core";
import type { Schemas } from "@sunset/api-client/staff";
import { Badge, Body, Card, Row, colors } from "@sunset/ui";
import { OCCUPANCY_LABELS, STATUS_LABELS, overdueLabel } from "../lib/frontDesk";

type Booking = Pick<Schemas["Booking"], "id" | "guestName" | "checkIn" | "checkOut" | "status" | "occupancyStatus"> & {
  room?: { name: string } | null;
  roomUnit?: { label: string; housekeepingStatus?: Schemas["HousekeepingStatus"] } | null;
  roomUnitId?: string | null;
};

const statusColor = (s: Schemas["BookingStatus"]) => (s === "PAID" ? colors.green : s === "CANCELLED" ? colors.ink3 : s === "NEW" ? colors.sea : colors.slate);

/**
 * One booking in a list, opening its card. Badges follow the web's colour meanings: amber = attention
 * (no room yet, balance owed), coral = needs intervention (overdue), sand = room not cleaned.
 */
export function BookingRow({ booking, outstandingBalance, overdueDays, showDirty }: { booking: Booking; outstandingBalance?: string; overdueDays?: number; showDirty?: boolean }) {
  const room = booking.roomUnit ? `${booking.room?.name ?? "Room"} · ${booking.roomUnit.label}` : (booking.room?.name ?? "Room");
  const overdue = overdueLabel(overdueDays);
  return (
    <Card onPress={() => router.push(`/bookings/${booking.id}`)} accent={overdue ? colors.coral : undefined}>
      <Row style={{ justifyContent: "space-between" }}>
        <Body style={{ flex: 1 }}>{booking.guestName}</Body>
        <Badge text={STATUS_LABELS[booking.status]} color={statusColor(booking.status)} />
      </Row>
      <Body muted>{`${room} · ${formatDate(booking.checkIn)} → ${formatDate(booking.checkOut)}`}</Body>
      <Row style={{ flexWrap: "wrap" }}>
        <Badge text={OCCUPANCY_LABELS[booking.occupancyStatus]} color={colors.ink3} />
        {overdue ? <Badge text={overdue} color={colors.coralDeep} /> : null}
        {booking.roomUnitId === null ? <Badge text="No room assigned" color={colors.amber} /> : null}
        {showDirty && booking.roomUnit?.housekeepingStatus === "DIRTY" ? <Badge text="Not cleaned" color={colors.sand} /> : null}
        {isPositiveAmount(outstandingBalance) ? <Badge text={`Owes ${formatBaht(outstandingBalance)}`} color={colors.amber} /> : null}
      </Row>
    </Card>
  );
}
