import { useState } from "react";
import { call } from "@sunset/api-client";
import { addDays, formatBaht, formatDate, hotelDateKey } from "@sunset/core";
import { Body, Button, Card, Choice, ErrorText, Field, Label, Loading, Row, Screen } from "@sunset/ui";
import { RequireCapability } from "../../../components/Guard";
import { MonthStepper } from "../../../components/ReportBits";
import { confirmAsActor } from "../../../components/ActorConfirm";
import { monthOf, monthRange } from "../../../lib/reports";
import { parsePrice, validateInclusiveRange } from "../../../lib/settings";
import { useAction, useLoad } from "../../../lib/hooks";
import { useSignedIn } from "../../../lib/session";

export default function Rates() {
  return (
    <RequireCapability capability="settings.manage">
      <RatesBody />
    </RequireCapability>
  );
}

/**
 * Nightly prices per room type (GET/PATCH /pricing/{roomId}). The server stores one rate per night;
 * a booking already agreed keeps its own frozen price whatever is set here.
 */
function RatesBody() {
  const { api, user } = useSignedIn();
  const today = hotelDateKey(new Date());
  const rooms = useLoad(() => call(api.GET("/rooms"), "Could not load room types."), [api]);
  const [roomId, setRoomId] = useState<string | null>(null);
  const [ym, setYm] = useState(monthOf(today));
  const month = `${ym.year}-${String(ym.month).padStart(2, "0")}`;
  const pricing = useLoad(
    async () => (roomId ? call(api.GET("/pricing/{roomId}", { params: { path: { roomId }, query: { month } } }), "Could not load rates.") : { ok: true as const, data: { basePrice: 0, days: [] }, status: 200 }),
    [api, roomId, month],
  );
  const [from, setFrom] = useState(monthRange(ym).from < today ? today : monthRange(ym).from);
  const [to, setTo] = useState(from);
  const [price, setPrice] = useState("");
  const write = useAction();
  const parsed = parsePrice(price);
  const rangeError = validateInclusiveRange(from, to);

  async function apply() {
    if (!roomId || parsed === null) return;
    const r = await write.run(() => call(api.PATCH("/pricing/{roomId}", { params: { path: { roomId } }, body: { from, to, price: parsed } }), "Could not set the rate."));
    if (r.ok) {
      setPrice("");
      void pricing.reload();
    }
  }

  return (
    <Screen>
      <ErrorText>{rooms.error}</ErrorText>
      {rooms.loading && !rooms.data ? <Loading /> : null}
      <Choice label="Room type" options={(rooms.data ?? []).map((r) => ({ value: r.id, label: r.name }))} value={roomId} onChange={setRoomId} />
      {roomId ? (
        <>
          <Card>
            <Label>Set a price for a range of nights</Label>
            <Row style={{ justifyContent: "space-between", alignItems: "center" }}>
              <Body muted>From</Body>
              <Row style={{ alignItems: "center" }}>
                <Button title="‹" variant="secondary" onPress={() => setFrom(addDays(from, -1))} />
                <Body>{formatDate(from)}</Body>
                <Button title="›" variant="secondary" onPress={() => { const n = addDays(from, 1); setFrom(n); if (n > to) setTo(n); }} />
              </Row>
            </Row>
            <Row style={{ justifyContent: "space-between", alignItems: "center" }}>
              <Body muted>To (last night)</Body>
              <Row style={{ alignItems: "center" }}>
                <Button title="‹" variant="secondary" disabled={to <= from} onPress={() => setTo(addDays(to, -1))} />
                <Body>{formatDate(to)}</Body>
                <Button title="›" variant="secondary" onPress={() => setTo(addDays(to, 1))} />
              </Row>
            </Row>
            <Field label="Price per night (฿)" value={price} onChangeText={setPrice} keyboardType="decimal-pad" />
            <ErrorText>{rangeError}</ErrorText>
            <Button
              title="Set price"
              busy={write.busy}
              disabled={parsed === null || !!rangeError}
              onPress={() => parsed !== null && confirmAsActor("Set price", `${formatBaht(String(parsed))} a night, ${formatDate(from)} → ${formatDate(to)}. Agreed bookings keep their price.`, user.name, () => void apply(), "Set price")}
            />
            <ErrorText>{write.error}</ErrorText>
          </Card>
          <MonthStepper value={ym} onChange={setYm} />
          <ErrorText>{pricing.error}</ErrorText>
          {pricing.loading && !pricing.data?.days.length ? <Loading /> : null}
          {pricing.data?.days.map((d) => (
            <Row key={d.date} style={{ justifyContent: "space-between" }}>
              <Body muted>{formatDate(d.date)}</Body>
              <Body>{`${formatBaht(String(d.price))}${d.isOverride ? "" : " (base)"}`}</Body>
            </Row>
          ))}
        </>
      ) : (
        <Body muted>Pick a room type to see and set its nightly prices.</Body>
      )}
    </Screen>
  );
}
