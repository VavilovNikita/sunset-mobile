import { useState } from "react";
import { View } from "react-native";
import { call } from "@sunset/api-client";
import type { Schemas } from "@sunset/api-client/staff";
import { Body, Button, Card, Choice, ErrorText, Field, Label, Loading, Row, Screen, Toggle } from "@sunset/ui";
import { RequireCapability } from "../../../components/Guard";
import { parseWhole, validateTable } from "../../../lib/settings";
import { useAction, useLoad } from "../../../lib/hooks";
import { useSignedIn } from "../../../lib/session";

type Table = Schemas["Table"];
type Zone = Schemas["Zone"];
const ZONES: { value: Zone; label: string }[] = [
  { value: "RESTAURANT", label: "Restaurant" },
  { value: "BAR", label: "Bar" },
  { value: "POOL", label: "Pool" },
  { value: "SPA", label: "Spa" },
  { value: "ROOM_SERVICE", label: "Room service" },
];

export default function TablesSettings() {
  return (
    <RequireCapability capability="settings.manage">
      <TablesBody />
    </RequireCapability>
  );
}

function TableForm({ table, busy, onSubmit, onCancel }: { table?: Table; busy: boolean; onSubmit: (input: Schemas["TableInput"]) => void; onCancel: () => void }) {
  const [zone, setZone] = useState<Zone>(table?.zone ?? "RESTAURANT");
  const [label, setLabel] = useState(table?.label ?? "");
  const [capacity, setCapacity] = useState(String(table?.capacity ?? 4));
  const error = validateTable(label, capacity);
  return (
    <View style={{ gap: 8 }}>
      <Choice label="Zone" options={ZONES} value={zone} onChange={setZone} />
      <Field label="Name" value={label} onChangeText={setLabel} />
      <Field label="Seats" value={capacity} onChangeText={setCapacity} keyboardType="number-pad" />
      <ErrorText>{label || capacity !== String(table?.capacity ?? 4) ? error : null}</ErrorText>
      <Row>
        <Button
          title={table ? "Save" : "Add table"}
          busy={busy}
          disabled={!!error}
          onPress={() => onSubmit({ zone, label: label.trim(), capacity: parseWhole(capacity, 1, 50) ?? 1, shape: table?.shape ?? "SQUARE", isActive: table?.isActive ?? true })}
        />
        <Button title="Close" variant="secondary" onPress={onCancel} />
      </Row>
    </View>
  );
}

function TablesBody() {
  const { api } = useSignedIn();
  const tables = useLoad(() => call(api.GET("/tables"), "Could not load tables."), [api]);
  const [editing, setEditing] = useState<string | null>(null);
  const write = useAction();
  const list = tables.data ?? [];

  async function update(table: Table, input: Schemas["TableInput"]) {
    const r = await write.run(() => call(api.PATCH("/tables/{id}", { params: { path: { id: table.id } }, body: input }), "Could not save the table."));
    if (r.ok && tables.data) {
      tables.apply(tables.data.map((t) => (t.id === r.data.id ? r.data : t)));
      setEditing(null);
    }
  }
  async function create(input: Schemas["TableInput"]) {
    const r = await write.run(() => call(api.POST("/tables", { body: input }), "Could not add the table."));
    if (r.ok && tables.data) {
      tables.apply([...tables.data, r.data]);
      setEditing(null);
    }
  }
  const inputOf = (t: Table, isActive: boolean): Schemas["TableInput"] => ({ zone: t.zone, label: t.label, capacity: t.capacity, shape: t.shape, isActive });

  return (
    <Screen>
      <ErrorText>{tables.error}</ErrorText>
      <ErrorText>{write.error}</ErrorText>
      {tables.loading && !tables.data ? <Loading /> : null}
      {editing === "new" ? (
        <Card>
          <TableForm busy={write.busy} onSubmit={(i) => void create(i)} onCancel={() => setEditing(null)} />
        </Card>
      ) : (
        <Button title="Add table" onPress={() => setEditing("new")} />
      )}
      {ZONES.filter((z) => list.some((t) => t.zone === z.value)).map((z) => (
        <View key={z.value} style={{ gap: 8 }}>
          <Label>{z.label}</Label>
          {list
            .filter((t) => t.zone === z.value)
            .sort((a, b) => a.label.localeCompare(b.label, undefined, { numeric: true }))
            .map((t) => (
              <Card key={t.id}>
                <Body>{`${t.label} · ${t.capacity} seat${t.capacity === 1 ? "" : "s"}`}</Body>
                <Toggle label={t.isActive ? "In use" : "Not in use"} value={t.isActive} disabled={write.busy} onChange={(v) => void update(t, inputOf(t, v))} />
                {editing === t.id ? (
                  <TableForm table={t} busy={write.busy} onSubmit={(i) => void update(t, i)} onCancel={() => setEditing(null)} />
                ) : (
                  <Button title="Edit" variant="secondary" onPress={() => setEditing(t.id)} />
                )}
              </Card>
            ))}
        </View>
      ))}
      <Body muted>Placing tables on the floor plan is done on the web admin.</Body>
    </Screen>
  );
}
