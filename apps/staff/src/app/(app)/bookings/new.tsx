import { useState } from "react";
import { router } from "expo-router";
import { call } from "@sunset/api-client";
import type { Schemas } from "@sunset/api-client/staff";
import { addDays, formatBaht, formatDate, hotelDateKey } from "@sunset/core";
import { Body, Button, Card, Choice, ErrorText, Field, Label, Loading, Row, Screen } from "@sunset/ui";
import { RequireCapability } from "../../../components/Guard";
import { CHANNEL_OPTIONS, validateStaffBooking } from "../../../lib/staffBooking";
import { useAction, useLoad } from "../../../lib/hooks";
import { useSignedIn } from "../../../lib/session";

export default function NewBooking() {
  return (
    <RequireCapability capability="frontdesk">
      <NewBookingBody />
    </RequireCapability>
  );
}

function Stepper({ label, value, onChange, min, max }: { label: string; value: number; onChange: (n: number) => void; min: number; max?: number }) {
  return (
    <Row style={{ justifyContent: "space-between", alignItems: "center" }}>
      <Body>{`${label}: ${value}`}</Body>
      <Row>
        <Button title="−" variant="secondary" disabled={value <= min} onPress={() => onChange(value - 1)} />
        <Button title="+" variant="secondary" disabled={max != null && value >= max} onPress={() => onChange(value + 1)} />
      </Row>
    </Row>
  );
}

/**
 * A front-desk booking (POST /bookings/staff). The price is the server's quote for exactly these
 * dates and room (POST /bookings/staff/quote), re-asked on every change - never added up here.
 */
function NewBookingBody() {
  const { api } = useSignedIn();
  const today = hotelDateKey(new Date());
  const rooms = useLoad(() => call(api.GET("/rooms"), "Could not load room types."), [api]);
  const units = useLoad(() => call(api.GET("/room-units"), "Could not load rooms."), [api]);
  const [roomId, setRoomId] = useState<string | null>(null);
  const [unitId, setUnitId] = useState<string | null>(null);
  const [checkIn, setCheckIn] = useState(today);
  const [nights, setNights] = useState(1);
  const checkOut = addDays(checkIn, nights);
  const [guestName, setGuestName] = useState("");
  const [guestEmail, setGuestEmail] = useState("");
  const [guestPhone, setGuestPhone] = useState("");
  const [channel, setChannel] = useState<Schemas["BookingChannel"] | null>("WALK_IN");
  const [purpose, setPurpose] = useState<Schemas["BookingPurpose"]>("STANDARD");
  const [adults, setAdults] = useState(2);
  const [children, setChildren] = useState(0);
  const [touched, setTouched] = useState(false);
  const save = useAction();

  const room = rooms.data?.find((r) => r.id === roomId) ?? null;
  const quote = useLoad<Schemas["BookingScheduleQuote"] | null>(
    async () =>
      roomId
        ? call(api.POST("/bookings/staff/quote", { body: { roomId, checkIn, checkOut, roomUnitId: unitId } }), "Could not get the price.")
        : { ok: true as const, data: null as Schemas["BookingScheduleQuote"] | null, status: 200 },
    [api, roomId, unitId, checkIn, checkOut],
  );
  const errors = validateStaffBooking({ guestName, guestEmail, guestPhone, channel, adults, children });
  const unitOptions = (units.data ?? [])
    .filter((u) => u.roomId === roomId && u.isActive)
    .sort((a, b) => a.label.localeCompare(b.label, undefined, { numeric: true }))
    .map((u) => ({ value: u.id, label: u.label }));

  async function create() {
    setTouched(true);
    if (!roomId || Object.keys(errors).length > 0 || !channel) return;
    const r = await save.run(() =>
      call(
        api.POST("/bookings/staff", {
          body: {
            roomId,
            roomUnitId: unitId,
            checkIn,
            checkOut,
            guestName: guestName.trim(),
            guestEmail: guestEmail.trim() || null,
            guestPhone: guestPhone.trim() || null,
            channel,
            purpose,
            adults,
            children,
          },
        }),
        "Could not create the booking.",
      ),
    );
    if (r.ok) router.replace(`/bookings/${r.data.id}`);
  }

  if (rooms.loading && !rooms.data) return <Loading />;
  return (
    <Screen>
      <ErrorText>{rooms.error ?? units.error}</ErrorText>
      <Choice
        label="Room type"
        options={(rooms.data ?? []).map((r) => ({ value: r.id, label: r.name, hint: `sleeps ${r.capacity}` }))}
        value={roomId}
        onChange={(v) => {
          setRoomId(v);
          setUnitId(null);
        }}
      />
      {roomId ? <Choice label="Room (optional - assign now or later)" options={unitOptions} value={unitId} onChange={(v) => setUnitId(v === unitId ? null : v)} /> : null}
      <Card>
        <Label>Check-in</Label>
        <Row style={{ justifyContent: "space-between", alignItems: "center" }}>
          <Button title="‹" variant="secondary" disabled={checkIn <= today} onPress={() => setCheckIn(addDays(checkIn, -1))} />
          <Body>{formatDate(checkIn)}</Body>
          <Button title="›" variant="secondary" onPress={() => setCheckIn(addDays(checkIn, 1))} />
        </Row>
        <Stepper label={`Nights (out ${formatDate(checkOut)})`} value={nights} onChange={setNights} min={1} max={90} />
      </Card>
      {roomId ? (
        <Card>
          {quote.loading && !quote.data ? <Loading label="Getting the price…" /> : null}
          {quote.data ? (
            quote.data.available ? (
              <Body>{`${formatBaht(quote.data.totalPrice)} for ${quote.data.nights} night${quote.data.nights === 1 ? "" : "s"}`}</Body>
            ) : (
              <ErrorText>{quote.data.reason ?? "Not available for these dates."}</ErrorText>
            )
          ) : null}
          <ErrorText>{quote.error}</ErrorText>
        </Card>
      ) : null}
      <Field label="Guest name" value={guestName} onChangeText={setGuestName} autoComplete="name" />
      {touched ? <ErrorText>{errors.guestName}</ErrorText> : null}
      <Field label="Email (optional)" value={guestEmail} onChangeText={setGuestEmail} keyboardType="email-address" autoCapitalize="none" />
      {touched ? <ErrorText>{errors.guestEmail}</ErrorText> : null}
      <Field label="Phone (optional)" value={guestPhone} onChangeText={setGuestPhone} keyboardType="phone-pad" />
      {touched ? <ErrorText>{errors.guestPhone}</ErrorText> : null}
      <Stepper label="Adults" value={adults} onChange={setAdults} min={1} max={room?.capacity} />
      <Stepper label="Children" value={children} onChange={setChildren} min={0} max={room ? Math.max(0, room.capacity - adults) : undefined} />
      <Choice label="Came in via" options={CHANNEL_OPTIONS} value={channel} onChange={setChannel} />
      {touched ? <ErrorText>{errors.channel}</ErrorText> : null}
      <Choice
        label="Purpose"
        options={[
          { value: "STANDARD", label: "Standard" },
          { value: "COMPLIMENTARY", label: "Complimentary" },
          { value: "HOUSE_USE", label: "House use" },
        ]}
        value={purpose}
        onChange={setPurpose}
      />
      <Button title="Create booking" busy={save.busy} disabled={!roomId || quote.data?.available === false} onPress={() => void create()} />
      <ErrorText>{save.error}</ErrorText>
    </Screen>
  );
}
