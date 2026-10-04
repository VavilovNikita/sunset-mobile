import { useState } from "react";
import { View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { call } from "@sunset/api-client";
import type { Schemas } from "@sunset/api-client/staff";
import { formatBaht, formatDate, formatTimestamp, hotelDateKey, isPositiveAmount } from "@sunset/core";
import { Badge, Body, Button, Card, Choice, ErrorText, Field, Label, Loading, Row, Screen, Title, colors } from "@sunset/ui";
import { RequireCapability } from "../../../components/Guard";
import { confirmAsActor } from "../../../components/ActorConfirm";
import { ask } from "../../../lib/ask";
import { OCCUPANCY_LABELS, STATUS_LABELS, overdueDaysFor, overdueLabel, parsePaymentAmount, statusActions, stayActions, validateCancelReason } from "../../../lib/frontDesk";
import { useAction, useLoad } from "../../../lib/hooks";
import { useSignedIn } from "../../../lib/session";

type Booking = Schemas["Booking"];

export default function BookingCard() {
  return (
    <RequireCapability capability="frontdesk">
      <BookingBody />
    </RequireCapability>
  );
}

function BookingBody() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { api } = useSignedIn();
  const booking = useLoad(() => call(api.GET("/bookings/{id}", { params: { path: { id } } }), "Could not load the booking."), [api, id]);
  // Folio figures change with every payment and check-out; bumping this reloads them.
  const [folioVersion, setFolioVersion] = useState(0);
  const update = (b: Booking) => {
    booking.apply(b);
    setFolioVersion((v) => v + 1);
  };

  if (booking.loading && !booking.data) return <Loading />;
  if (!booking.data) {
    return (
      <Screen>
        <ErrorText>{booking.error ?? "Booking not found."}</ErrorText>
        <Button title="Try again" onPress={() => void booking.reload()} />
      </Screen>
    );
  }
  const b = booking.data;
  return (
    <Screen>
      <Title>{b.guestName}</Title>
      <ErrorText>{booking.error}</ErrorText>
      <Summary booking={b} />
      <Stay booking={b} onChange={update} />
      <RoomAssignment booking={b} onChange={update} />
      <StatusPanel booking={b} onChange={update} />
      <Folio booking={b} version={folioVersion} onPaid={() => setFolioVersion((v) => v + 1)} />
    </Screen>
  );
}

function Summary({ booking: b }: { booking: Booking }) {
  return (
    <Card>
      <Row style={{ flexWrap: "wrap" }}>
        <Badge text={STATUS_LABELS[b.status]} color={b.status === "PAID" ? colors.green : b.status === "NEW" ? colors.sea : b.status === "CANCELLED" ? colors.ink3 : colors.slate} />
        <Badge text={OCCUPANCY_LABELS[b.occupancyStatus]} color={colors.ink3} />
        {b.purpose !== "STANDARD" ? <Badge text={b.purpose === "COMPLIMENTARY" ? "Complimentary" : "House use"} color={colors.ink3} /> : null}
      </Row>
      <Body>{`${b.room.name}${b.roomUnit ? ` · ${b.roomUnit.label}` : ""}`}</Body>
      <Body muted>{`${formatDate(b.checkIn)} → ${formatDate(b.checkOut)} · ${b.adults} adult${b.adults === 1 ? "" : "s"}${b.children ? `, ${b.children} child${b.children === 1 ? "" : "ren"}` : ""}`}</Body>
      <Body muted>{`Room total ${formatBaht(b.totalPrice)} · ${b.channel.replace("_", " ").toLowerCase()}${b.externalReference ? ` · ref ${b.externalReference}` : ""}`}</Body>
      {b.guestPhone ? <Body muted>{b.guestPhone}</Body> : null}
      {b.guestEmail ? <Body muted>{b.guestEmail}</Body> : null}
      {b.paymentNote ? <Body muted>{`Payment note: ${b.paymentNote}`}</Body> : null}
      {b.cancellationReason ? <Body muted>{`Cancelled: ${b.cancellationReason}`}</Body> : null}
      {b.guestId ? <Button title="Guest card" variant="secondary" onPress={() => router.push(`/guests/${b.guestId}`)} /> : null}
    </Card>
  );
}

/** Check-in / no-show / check-out - the web booking panel's rules (lib/frontDesk.ts#stayActions). */
function Stay({ booking: b, onChange }: { booking: Booking; onChange: (b: Booking) => void }) {
  const { api } = useSignedIn();
  const action = useAction();
  const [note, setNote] = useState<string | null>(null);
  const today = hotelDateKey(new Date());
  const can = stayActions(b, today);
  const overdue = overdueLabel(overdueDaysFor(b, today));

  async function checkIn() {
    setNote(null);
    const r = await action.run(() => call(api.POST("/bookings/{id}/check-in", { params: { path: { id: b.id } } }), "Could not check in."));
    if (r.ok) {
      onChange(r.data.booking);
      setNote(r.data.warning ?? null);
    }
  }
  async function checkOut() {
    setNote(null);
    const r = await action.run(() => call(api.POST("/bookings/{id}/check-out", { params: { path: { id: b.id } } }), "Could not check out."));
    if (r.ok) {
      onChange(r.data.booking);
      // Front desk warns, it doesn't block: the guest is checked out either way.
      if (isPositiveAmount(r.data.outstandingBalance)) setNote(`${formatBaht(r.data.outstandingBalance)} still owed — collect it.`);
    }
  }
  async function noShow() {
    setNote(null);
    const r = await action.run(() => call(api.POST("/bookings/{id}/no-show", { params: { path: { id: b.id } } }), "Could not mark as no-show."));
    if (r.ok) onChange(r.data);
  }

  return (
    <Card accent={overdue ? colors.coral : undefined}>
      <Label>Stay</Label>
      {overdue ? (
        <Body>{`${overdue} — was due out on ${formatDate(b.checkOut)} and is still checked in, so the room is held tonight. Check out if they've left; extend the stay on the web admin if they're staying.`}</Body>
      ) : null}
      {can.lateArrival ? <Body>{`Was due to arrive on ${formatDate(b.checkIn)}. Check in, or mark a no-show.`}</Body> : null}
      {can.checkIn ? (
        <>
          <Button title="Check in" busy={action.busy} disabled={can.needsRoom} onPress={() => void checkIn()} />
          {can.needsRoom ? <Body muted>Assign a room before checking in.</Body> : null}
        </>
      ) : null}
      {can.noShow ? (
        <Button
          title="Mark no-show"
          variant="secondary"
          disabled={action.busy}
          onPress={() => ask("No-show", `Mark ${b.guestName} as a no-show? The booking's dates and price don't change.`, [{ text: "Cancel", style: "cancel" }, { text: "Mark no-show", onPress: () => void noShow() }])}
        />
      ) : null}
      {can.checkOut ? (
        <Button
          title="Check out"
          busy={action.busy}
          onPress={() =>
            overdue
              ? ask("Check out", `Check ${b.guestName} out now? They were due out on ${formatDate(b.checkOut)}.`, [{ text: "Cancel", style: "cancel" }, { text: "Check out", onPress: () => void checkOut() }])
              : void checkOut()
          }
        />
      ) : null}
      {!can.checkIn && !can.noShow && !can.checkOut ? <Body muted>{OCCUPANCY_LABELS[b.occupancyStatus]}</Body> : null}
      {note ? <Body>{note}</Body> : null}
      <ErrorText>{action.error}</ErrorText>
    </Card>
  );
}

/** Assign a physical room. Only the never-relocated (single-segment) case - the server rejects the rest. */
function RoomAssignment({ booking: b, onChange }: { booking: Booking; onChange: (b: Booking) => void }) {
  const { api } = useSignedIn();
  const action = useAction();
  const relocated = b.segments.length > 1;
  const editable = !relocated && b.status !== "CANCELLED" && b.occupancyStatus !== "CHECKED_OUT";
  const units = useLoad(async () => (editable ? call(api.GET("/room-units"), "Could not load rooms.") : { ok: true as const, data: [], status: 200 }), [api, editable]);
  const [unitId, setUnitId] = useState<string | null>(b.roomUnitId);
  const options = (units.data ?? []).filter((u) => u.roomId === b.roomId && u.isActive)
    .sort((x, y) => x.label.localeCompare(y.label, undefined, { numeric: true }))
    .map((u) => ({ value: u.id, label: u.label, hint: u.housekeepingStatus === "DIRTY" ? "not cleaned" : undefined }));

  async function save(roomUnitId: string | null) {
    const r = await action.run(() => call(api.PUT("/bookings/{id}/room-unit", { params: { path: { id: b.id } }, body: { roomUnitId } }), "Could not change the room."));
    if (r.ok) onChange(r.data);
  }

  if (relocated) {
    return (
      <Card>
        <Label>Rooms</Label>
        {b.segments.map((s) => (
          <Body key={s.id} muted>{`${formatDate(s.checkIn)} → ${formatDate(s.checkOut)} · ${s.room.name}${s.roomUnit ? ` · ${s.roomUnit.label}` : " · no room"}`}</Body>
        ))}
        <Body muted>A relocated stay - change its rooms on the web admin.</Body>
      </Card>
    );
  }
  if (!editable) return null;
  return (
    <Card accent={b.roomUnitId === null ? colors.amber : undefined}>
      <Label>Room</Label>
      <ErrorText>{units.error}</ErrorText>
      {units.loading && !units.data ? <Loading /> : null}
      <Choice options={options} value={unitId} onChange={setUnitId} />
      <Row>
        <Button title="Assign room" busy={action.busy} disabled={!unitId || unitId === b.roomUnitId} onPress={() => void save(unitId)} />
        {b.roomUnitId ? <Button title="Unassign" variant="secondary" disabled={action.busy} onPress={() => void save(null)} /> : null}
      </Row>
      <Body muted>The server checks the room is free for these dates.</Body>
      <ErrorText>{action.error}</ErrorText>
    </Card>
  );
}

function StatusPanel({ booking: b, onChange }: { booking: Booking; onChange: (b: Booking) => void }) {
  const { api } = useSignedIn();
  const action = useAction();
  const [cancelling, setCancelling] = useState(false);
  const [reason, setReason] = useState("");
  const actions = statusActions(b.status);
  if (actions.length === 0) return null;

  async function setStatus(status: Schemas["BookingStatus"], cancellationReason?: string) {
    const r = await action.run(() =>
      call(api.PATCH("/bookings/{id}", { params: { path: { id: b.id } }, body: { status, cancellationReason: cancellationReason ?? null } }), "Could not change the status."),
    );
    if (r.ok) {
      setCancelling(false);
      setReason("");
      onChange(r.data);
    }
  }
  const reasonError = validateCancelReason(reason);

  return (
    <Card>
      <Label>Booking status</Label>
      <Row style={{ flexWrap: "wrap" }}>
        {actions
          .filter((a) => a.to !== "CANCELLED")
          .map((a) => (
            <Button
              key={a.to}
              title={a.label}
              variant="secondary"
              disabled={action.busy}
              onPress={() =>
                ask(a.label, a.to === "PAID" ? `Mark ${b.guestName}'s room (${formatBaht(b.totalPrice)}) as paid? The guest gets an email.` : `${a.label} for ${b.guestName}?`, [
                  { text: "Back", style: "cancel" },
                  { text: a.label, onPress: () => void setStatus(a.to) },
                ])
              }
            />
          ))}
      </Row>
      {actions.some((a) => a.to === "CANCELLED") ? (
        cancelling ? (
          <View style={{ gap: 8 }}>
            <Field label="Why is it being cancelled?" value={reason} onChangeText={setReason} />
            <Row>
              <Button title="Cancel booking" variant="danger" busy={action.busy} disabled={!!reasonError} onPress={() => void setStatus("CANCELLED", reason.trim())} />
              <Button title="Keep it" variant="secondary" onPress={() => setCancelling(false)} />
            </Row>
            <Body muted>The room is released and the guest gets an email.</Body>
          </View>
        ) : (
          <Button title="Cancel booking…" variant="danger" onPress={() => setCancelling(true)} />
        )
      ) : null}
      <ErrorText>{action.error}</ErrorText>
    </Card>
  );
}

/**
 * The server's folio figures, the settlement history and the restaurant charges behind them, and a
 * payment form. Nothing is added up on the phone: every figure here is the server's.
 */
function Folio({ booking: b, version, onPaid }: { booking: Booking; version: number; onPaid: () => void }) {
  const { api, user } = useSignedIn();
  const folio = useLoad(() => call(api.GET("/bookings/{id}/folio", { params: { path: { id: b.id } } }), "Could not load the folio."), [api, b.id, version]);
  const payments = useLoad(() => call(api.GET("/bookings/{id}/folio-payments", { params: { path: { id: b.id } } }), "Could not load payments."), [api, b.id, version]);
  const orders = useLoad(() => call(api.GET("/bookings/{id}/pos-orders", { params: { path: { id: b.id } } }), "Could not load room charges."), [api, b.id, version]);
  const [method, setMethod] = useState<Schemas["FolioPaymentMethod"] | null>(null);
  const [amount, setAmount] = useState("");
  const pay = useAction();
  const parsed = parsePaymentAmount(amount);

  return (
    <Card>
      <Label>Folio</Label>
      <ErrorText>{folio.error}</ErrorText>
      {folio.data ? (
        <>
          <Row style={{ justifyContent: "space-between" }}>
            <Body muted>{`Room${b.status === "PAID" ? " (paid)" : ""}`}</Body>
            <Body>{formatBaht(folio.data.roomTotal)}</Body>
          </Row>
          <Row style={{ justifyContent: "space-between" }}>
            <Body muted>Restaurant & spa charges still owed</Body>
            <Body>{formatBaht(folio.data.roomChargesTotal)}</Body>
          </Row>
          <Row style={{ justifyContent: "space-between" }}>
            <Body muted>Stay total</Body>
            <Body>{formatBaht(folio.data.folioTotal)}</Body>
          </Row>
        </>
      ) : folio.loading ? (
        <Loading />
      ) : null}

      {orders.data && orders.data.length > 0 ? (
        <View style={{ gap: 4 }}>
          <Label>Charged to the room</Label>
          {orders.data.map((o) => (
            <Row key={o.orderId} style={{ justifyContent: "space-between" }}>
              <Body muted style={{ flex: 1 }}>{`${formatTimestamp(o.paidAt)} · ${o.items.map((i) => `${i.quantity}× ${i.name}`).join(", ")}`}</Body>
              <Body>{formatBaht(o.amount)}</Body>
            </Row>
          ))}
        </View>
      ) : null}
      <ErrorText>{orders.error}</ErrorText>

      {payments.data && payments.data.length > 0 ? (
        <View style={{ gap: 4 }}>
          <Label>Payments</Label>
          {payments.data.map((p) => (
            <Row key={p.id} style={{ justifyContent: "space-between" }}>
              <Body muted>{`${formatTimestamp(p.createdAt)} · ${p.method.toLowerCase()}`}</Body>
              <Body>{formatBaht(p.amount)}</Body>
            </Row>
          ))}
        </View>
      ) : null}
      <ErrorText>{payments.error}</ErrorText>

      {b.status !== "CANCELLED" ? (
        <View style={{ gap: 8 }}>
          <Label>Record a payment</Label>
          <Choice
            options={[
              { value: "CASH", label: "Cash" },
              { value: "CARD", label: "Card" },
              { value: "OTHER", label: "Other" },
            ]}
            value={method}
            onChange={setMethod}
          />
          <Field label="Amount (฿)" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" />
          {amount.trim() && !parsed ? <ErrorText>Enter an amount like 1500 or 1500.50</ErrorText> : null}
          <Button
            title="Record payment"
            busy={pay.busy}
            disabled={!method || !parsed}
            onPress={() =>
              method &&
              parsed &&
              confirmAsActor("Record payment", `${method.toLowerCase()} payment of ${formatBaht(parsed)} on ${b.guestName}'s folio.`, user.name, async () => {
                const r = await pay.run(() =>
                  call(api.POST("/bookings/{id}/folio-payments", { params: { path: { id: b.id } }, body: { method, amount: parsed } }), "Could not record the payment."),
                );
                if (r.ok) {
                  setAmount("");
                  setMethod(null);
                  onPaid();
                }
              }, "Record payment")
            }
          />
          <Body muted>Settles restaurant and spa charges on the room; the room itself is settled with "Mark paid". The server refuses more than is owed.</Body>
          <ErrorText>{pay.error}</ErrorText>
        </View>
      ) : null}
    </Card>
  );
}
