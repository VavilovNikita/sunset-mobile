import { useState } from "react";
import { View } from "react-native";
import { call } from "@sunset/api-client";
import type { Schemas } from "@sunset/api-client/staff";
import { formatBaht } from "@sunset/core";
import { Body, Button, Card, Choice, ErrorText, Field, Label, Loading, Row, Screen, Toggle } from "@sunset/ui";
import { RequireCapability } from "../../../components/Guard";
import { ask } from "../../../lib/ask";
import { parsePrice, parseWhole, validateMenuItem, type MenuItemDraft } from "../../../lib/settings";
import { useAction, useLoad } from "../../../lib/hooks";
import { useSignedIn } from "../../../lib/session";

type Item = Schemas["MenuItem"];

export default function MenuSettings() {
  return (
    <RequireCapability capability="settings.manage">
      <MenuBody />
    </RequireCapability>
  );
}

const draftOf = (i?: Item): MenuItemDraft => ({
  name: i?.name ?? "",
  category: i?.category ?? "",
  price: i ? i.price : "",
  department: i?.department ?? "KITCHEN",
  durationMinutes: i?.durationMinutes ? String(i.durationMinutes) : "",
});

/** PATCH /menu/{id} replaces every field, so every write sends the whole item. */
function toInput(d: MenuItemDraft, description: string, isAvailable: boolean): Schemas["MenuItemInput"] {
  return {
    name: d.name.trim(),
    category: d.category.trim(),
    description,
    department: d.department,
    price: parsePrice(d.price) ?? 0,
    isAvailable,
    durationMinutes: d.department === "SPA" ? parseWhole(d.durationMinutes, 1, 600) : null,
  };
}

function ItemForm({ initial, submitLabel, busy, onSubmit, onCancel }: { initial: MenuItemDraft; submitLabel: string; busy: boolean; onSubmit: (d: MenuItemDraft) => void; onCancel?: () => void }) {
  const [d, setD] = useState(initial);
  const [touched, setTouched] = useState(false);
  const errors = validateMenuItem(d);
  const set = (patch: Partial<MenuItemDraft>) => setD((x) => ({ ...x, ...patch }));
  return (
    <View style={{ gap: 8 }}>
      <Field label="Name" value={d.name} onChangeText={(name) => set({ name })} />
      {touched ? <ErrorText>{errors.name}</ErrorText> : null}
      <Field label="Category" value={d.category} onChangeText={(category) => set({ category })} />
      {touched ? <ErrorText>{errors.category}</ErrorText> : null}
      <Field label="Price (฿)" value={d.price} onChangeText={(price) => set({ price })} keyboardType="decimal-pad" />
      {touched ? <ErrorText>{errors.price}</ErrorText> : null}
      <Choice
        label="Prepared by"
        options={[
          { value: "KITCHEN", label: "Kitchen" },
          { value: "BAR", label: "Bar" },
          { value: "SPA", label: "Spa" },
        ]}
        value={d.department}
        onChange={(department) => set({ department })}
      />
      {d.department === "SPA" ? <Field label="Length (minutes)" value={d.durationMinutes} onChangeText={(durationMinutes) => set({ durationMinutes })} keyboardType="number-pad" /> : null}
      {touched ? <ErrorText>{errors.durationMinutes}</ErrorText> : null}
      <Row>
        <Button
          title={submitLabel}
          busy={busy}
          onPress={() => {
            setTouched(true);
            if (Object.keys(errors).length === 0) onSubmit(d);
          }}
        />
        {onCancel ? <Button title="Close" variant="secondary" onPress={onCancel} /> : null}
      </Row>
    </View>
  );
}

function MenuBody() {
  const { api } = useSignedIn();
  const menu = useLoad(() => call(api.GET("/menu"), "Could not load the menu."), [api]);
  const [editing, setEditing] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const write = useAction();
  const items = menu.data ?? [];
  const categories = [...new Set(items.map((i) => i.category))].sort();

  const replace = (next: Item) => menu.data && menu.apply(menu.data.map((i) => (i.id === next.id ? next : i)));
  async function save(item: Item, input: Schemas["MenuItemInput"]) {
    const r = await write.run(() => call(api.PATCH("/menu/{id}", { params: { path: { id: item.id } }, body: input }), "Could not save the item."));
    if (r.ok) {
      replace(r.data);
      setEditing(null);
    }
  }
  async function create(d: MenuItemDraft) {
    const r = await write.run(() => call(api.POST("/menu", { body: toInput(d, "", true) }), "Could not add the item."));
    if (r.ok && menu.data) {
      menu.apply([...menu.data, r.data]);
      setAdding(false);
    }
  }
  async function remove(item: Item) {
    const r = await write.run(() => call(api.DELETE("/menu/{id}", { params: { path: { id: item.id } } }), "Could not delete the item."));
    if (r.ok && menu.data) menu.apply(menu.data.filter((i) => i.id !== item.id));
  }

  return (
    <Screen>
      <ErrorText>{menu.error}</ErrorText>
      <ErrorText>{write.error}</ErrorText>
      {menu.loading && !menu.data ? <Loading /> : null}
      {adding ? (
        <Card>
          <Label>New item</Label>
          <ItemForm initial={draftOf()} submitLabel="Add item" busy={write.busy} onSubmit={(d) => void create(d)} onCancel={() => setAdding(false)} />
        </Card>
      ) : (
        <Button title="Add item" onPress={() => setAdding(true)} />
      )}
      {categories.map((cat) => (
        <View key={cat} style={{ gap: 8 }}>
          <Label>{cat}</Label>
          {items
            .filter((i) => i.category === cat)
            .sort((a, b) => a.name.localeCompare(b.name))
            .map((item) => (
              <Card key={item.id}>
                <Row style={{ justifyContent: "space-between" }}>
                  <Body style={{ flex: 1 }}>{`${item.name}${item.durationMinutes ? ` · ${item.durationMinutes} min` : ""}`}</Body>
                  <Body>{formatBaht(item.price)}</Body>
                </Row>
                <Toggle
                  label={item.isAvailable ? "On sale" : "Not available (hidden from the POS)"}
                  value={item.isAvailable}
                  disabled={write.busy}
                  onChange={(v) => void save(item, toInput(draftOf(item), item.description, v))}
                />
                {editing === item.id ? (
                  <>
                    <ItemForm initial={draftOf(item)} submitLabel="Save" busy={write.busy} onSubmit={(d) => void save(item, toInput(d, item.description, item.isAvailable))} onCancel={() => setEditing(null)} />
                    <Button
                      title="Delete item"
                      variant="danger"
                      onPress={() => ask("Delete item", `Delete ${item.name} from the menu? Past orders keep it.`, [{ text: "Keep", style: "cancel" }, { text: "Delete", style: "destructive", onPress: () => void remove(item) }])}
                    />
                  </>
                ) : (
                  <Button title="Edit" variant="secondary" onPress={() => setEditing(item.id)} />
                )}
              </Card>
            ))}
        </View>
      ))}
    </Screen>
  );
}
