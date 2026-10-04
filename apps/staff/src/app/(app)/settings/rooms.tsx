import { useState } from "react";
import { View } from "react-native";
import { call } from "@sunset/api-client";
import type { Schemas } from "@sunset/api-client/staff";
import { addDays, formatBaht, formatDate, hotelDateKey } from "@sunset/core";
import { Body, Button, Card, ErrorText, Field, Label, Loading, Row, Screen, Toggle } from "@sunset/ui";
import { RequireCapability } from "../../../components/Guard";
import { ask } from "../../../lib/ask";
import { parsePrice, parseWhole, validateInclusiveRange } from "../../../lib/settings";
import { useAction, useLoad } from "../../../lib/hooks";
import { useSignedIn } from "../../../lib/session";

type Room = Schemas["Room"];
type Unit = Schemas["RoomUnit"];

export default function RoomsSettings() {
  return (
    <RequireCapability capability="settings.manage">
      <RoomsBody />
    </RequireCapability>
  );
}

function DayPicker({ label, value, onChange, min }: { label: string; value: string; onChange: (v: string) => void; min?: string }) {
  return (
    <Row style={{ justifyContent: "space-between", alignItems: "center" }}>
      <Body muted>{label}</Body>
      <Row style={{ alignItems: "center" }}>
        <Button title="‹" variant="secondary" disabled={!!min && value <= min} onPress={() => onChange(addDays(value, -1))} />
        <Body>{formatDate(value)}</Body>
        <Button title="›" variant="secondary" onPress={() => onChange(addDays(value, 1))} />
      </Row>
    </Row>
  );
}

function RoomTypeForm({ room, busy, onSubmit, onCancel }: { room: Room; busy: boolean; onSubmit: (i: Schemas["RoomInput"]) => void; onCancel: () => void }) {
  const [name, setName] = useState(room.name);
  const [description, setDescription] = useState(room.description);
  const [capacity, setCapacity] = useState(String(room.capacity));
  const [price, setPrice] = useState(room.basePrice);
  const cap = parseWhole(capacity, 1, 50);
  const base = parsePrice(price);
  const error = !name.trim() ? "Enter a name." : cap === null ? "Sleeps must be 1 to 50." : base === null ? "Enter a base price like 3500." : null;
  return (
    <View style={{ gap: 8 }}>
      <Field label="Name" value={name} onChangeText={setName} />
      <Field label="Description" value={description} onChangeText={setDescription} multiline />
      <Field label="Sleeps" value={capacity} onChangeText={setCapacity} keyboardType="number-pad" />
      <Field label="Base price per night (฿)" value={price} onChangeText={setPrice} keyboardType="decimal-pad" />
      <Body muted>Already agreed stays keep their price; this applies to new quotes and nights without a rate.</Body>
      <ErrorText>{error}</ErrorText>
      <Row>
        <Button title="Save" busy={busy} disabled={!!error} onPress={() => cap !== null && base !== null && onSubmit({ name: name.trim(), description, capacity: cap, basePrice: base })} />
        <Button title="Close" variant="secondary" onPress={onCancel} />
      </Row>
    </View>
  );
}

/** Out-of-order blocks for one physical room (dates inclusive). Created even over a booking - with a warning. */
function Blocks({ unit }: { unit: Unit }) {
  const { api } = useSignedIn();
  const today = hotelDateKey(new Date());
  const blocks = useLoad(() => call(api.GET("/room-units/{id}/blocks", { params: { path: { id: unit.id } } }), "Could not load blocks."), [api, unit.id]);
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(today);
  const [reason, setReason] = useState("");
  const [warning, setWarning] = useState<string | null>(null);
  const write = useAction();
  const rangeError = validateInclusiveRange(from, to);

  async function add() {
    setWarning(null);
    const r = await write.run(() => call(api.POST("/room-units/{id}/blocks", { params: { path: { id: unit.id } }, body: { fromDate: from, toDate: to, reason: reason.trim() } }), "Could not block the room."));
    if (r.ok && blocks.data) {
      blocks.apply([...blocks.data, r.data.block]);
      setReason("");
      setWarning(r.data.warning ?? null);
    }
  }
  async function remove(block: Schemas["RoomUnitBlock"]) {
    const r = await write.run(() => call(api.DELETE("/room-units/{id}/blocks/{blockId}", { params: { path: { id: unit.id, blockId: block.id } } }), "Could not remove the block."));
    if (r.ok && blocks.data) blocks.apply(blocks.data.filter((b) => b.id !== block.id));
  }

  const current = (blocks.data ?? []).filter((b) => b.toDate >= today).sort((a, b) => a.fromDate.localeCompare(b.fromDate));
  return (
    <View style={{ gap: 8 }}>
      <Label>Out of order</Label>
      <ErrorText>{blocks.error}</ErrorText>
      {current.length === 0 ? <Body muted>No current or upcoming blocks.</Body> : null}
      {current.map((b) => (
        <Row key={b.id} style={{ justifyContent: "space-between" }}>
          <Body muted style={{ flex: 1 }}>{`${formatDate(b.fromDate)} → ${formatDate(b.toDate)}: ${b.reason}`}</Body>
          <Button title="Remove" variant="secondary" disabled={write.busy} onPress={() => ask("Remove block", `Put room ${unit.label} back on sale for ${formatDate(b.fromDate)} → ${formatDate(b.toDate)}?`, [{ text: "Keep", style: "cancel" }, { text: "Remove", onPress: () => void remove(b) }])} />
        </Row>
      ))}
      <DayPicker label="From" value={from} min={today} onChange={(v) => { setFrom(v); if (v > to) setTo(v); }} />
      <DayPicker label="To (last day)" value={to} min={from} onChange={setTo} />
      <Field label="Reason" value={reason} onChangeText={setReason} />
      <ErrorText>{rangeError}</ErrorText>
      <Button title="Block room" busy={write.busy} disabled={!!rangeError || !reason.trim()} onPress={() => void add()} />
      {warning ? <Body>{warning}</Body> : null}
      <ErrorText>{write.error}</ErrorText>
    </View>
  );
}

function UnitCard({ unit, onSaved }: { unit: Unit; onSaved: (u: Unit) => void }) {
  const { api } = useSignedIn();
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState(unit.label);
  const write = useAction();
  async function save(next: { label: string; isActive: boolean }) {
    const r = await write.run(() => call(api.PATCH("/room-units/{id}", { params: { path: { id: unit.id } }, body: next }), "Could not save the room."));
    if (r.ok) onSaved(r.data);
  }
  return (
    <Card>
      <Row style={{ justifyContent: "space-between" }}>
        <Body>{`Room ${unit.label}`}</Body>
        <Button title={open ? "Close" : "Manage"} variant="secondary" onPress={() => setOpen(!open)} />
      </Row>
      <Toggle label={unit.isActive ? "In service" : "Out of service (permanently)"} value={unit.isActive} disabled={write.busy} onChange={(isActive) => void save({ label: unit.label, isActive })} />
      {open ? (
        <>
          <Row style={{ alignItems: "flex-end" }}>
            <View style={{ flex: 1 }}>
              <Field label="Room number" value={label} onChangeText={setLabel} />
            </View>
            <Button title="Rename" variant="secondary" disabled={!label.trim() || label === unit.label} busy={write.busy} onPress={() => void save({ label: label.trim(), isActive: unit.isActive })} />
          </Row>
          <Blocks unit={unit} />
        </>
      ) : null}
      <ErrorText>{write.error}</ErrorText>
    </Card>
  );
}

function RoomsBody() {
  const { api } = useSignedIn();
  const rooms = useLoad(() => call(api.GET("/rooms"), "Could not load room types."), [api]);
  const units = useLoad(() => call(api.GET("/room-units"), "Could not load rooms."), [api]);
  const [editing, setEditing] = useState<string | null>(null);
  const [newUnit, setNewUnit] = useState<Record<string, string>>({});
  const write = useAction();

  async function saveType(room: Room, input: Schemas["RoomInput"]) {
    const r = await write.run(() => call(api.PATCH("/rooms/{id}", { params: { path: { id: room.id } }, body: input }), "Could not save the room type."));
    if (r.ok && rooms.data) {
      rooms.apply(rooms.data.map((x) => (x.id === r.data.id ? r.data : x)));
      setEditing(null);
    }
  }
  async function addUnit(room: Room) {
    const label = (newUnit[room.id] ?? "").trim();
    const r = await write.run(() => call(api.POST("/room-units", { body: { roomId: room.id, label, isActive: true } }), "Could not add the room."));
    if (r.ok && units.data) {
      units.apply([...units.data, r.data]);
      setNewUnit((m) => ({ ...m, [room.id]: "" }));
    }
  }

  return (
    <Screen>
      <ErrorText>{rooms.error ?? units.error}</ErrorText>
      <ErrorText>{write.error}</ErrorText>
      {(rooms.loading && !rooms.data) || (units.loading && !units.data) ? <Loading /> : null}
      {(rooms.data ?? []).map((room) => (
        <View key={room.id} style={{ gap: 8 }}>
          <Card>
            <Label>{room.name}</Label>
            <Body muted>{`Sleeps ${room.capacity} · base ${formatBaht(room.basePrice)} a night · ${room.activeUnitCount} in service`}</Body>
            {editing === room.id ? (
              <RoomTypeForm room={room} busy={write.busy} onSubmit={(i) => void saveType(room, i)} onCancel={() => setEditing(null)} />
            ) : (
              <Button title="Edit room type" variant="secondary" onPress={() => setEditing(room.id)} />
            )}
          </Card>
          {(units.data ?? [])
            .filter((u) => u.roomId === room.id)
            .sort((a, b) => a.label.localeCompare(b.label, undefined, { numeric: true }))
            .map((u) => (
              <UnitCard key={u.id} unit={u} onSaved={(next) => units.data && units.apply(units.data.map((x) => (x.id === next.id ? next : x)))} />
            ))}
          <Row style={{ alignItems: "flex-end" }}>
            <View style={{ flex: 1 }}>
              <Field label={`New ${room.name} room number`} value={newUnit[room.id] ?? ""} onChangeText={(v) => setNewUnit((m) => ({ ...m, [room.id]: v }))} />
            </View>
            <Button title="Add" variant="secondary" disabled={!(newUnit[room.id] ?? "").trim()} busy={write.busy} onPress={() => void addUnit(room)} />
          </Row>
        </View>
      ))}
      <Body muted>New room types, photos and the property map are on the web admin.</Body>
    </Screen>
  );
}
