import { useMemo, useState } from "react";
import { Modal, Pressable, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { call, type ApiResult } from "@sunset/api-client";
import type { Schemas } from "@sunset/api-client/staff";
import { cashChange, formatBaht, formatDate, formatTimestamp, hotelDateKey } from "@sunset/core";
import { Badge, Body, Button, Card, Choice, ErrorText, Field, Label, Loading, Row, Screen, Title, colors } from "@sunset/ui";
import { RequireCapability } from "../../../../components/Guard";
import { confirmAsActor } from "../../../../components/ActorConfirm";
import { can } from "../../../../lib/access";
import { nullOn404, useAction, useLoad } from "../../../../lib/hooks";
import {
  canEditLine,
  canVoidLine,
  isChargeableBooking,
  isOpenForItems,
  isTerminal,
  menuCategories,
  menuForOrder,
  orderLabel,
  validateVoidReason,
} from "../../../../lib/pos";
import { useSignedIn } from "../../../../lib/session";

type Order = Schemas["Order"];
type MenuItem = Schemas["MenuItem"];
type OrderItem = Schemas["OrderItem"];

export default function OrderScreen() {
  return (
    <RequireCapability capability="pos.use">
      <OrderBody />
    </RequireCapability>
  );
}

function OrderBody() {
  const { api } = useSignedIn();
  const params = useLocalSearchParams<{ id: string; tableId?: string }>();
  const isDraft = params.id === "new";

  const menu = useLoad(() => call(api.GET("/menu"), "Could not load the menu."), [api]);
  const tables = useLoad(() => call(api.GET("/tables"), "Could not load tables."), [api]);
  const order = useLoad<Order | null>(
    async () => (isDraft ? { ok: true, status: 200, data: null } : call(api.GET("/orders/{id}", { params: { path: { id: params.id } } }), "Could not load the order.")),
    [api, params.id, isDraft],
    // Stops polling once the order is paid or cancelled.
    { pollMs: isDraft ? undefined : 5_000 },
  );

  const tableId = order.data?.tableId ?? params.tableId ?? null;
  const table = tables.data?.find((t) => t.id === tableId) ?? null;
  const offered = useMemo(() => menuForOrder(menu.data ?? [], table?.zone ?? null), [menu.data, table?.zone]);
  const names = useMemo(() => new Map((menu.data ?? []).map((m) => [m.id, m.name])), [menu.data]);

  if (!isDraft && order.loading && !order.data) return <Loading />;
  if (!isDraft && !order.data) {
    return (
      <Screen>
        <ErrorText>{order.error ?? "Order not found."}</ErrorText>
        <Button title="Try again" onPress={() => void order.reload()} />
      </Screen>
    );
  }

  return (
    <Screen>
      <Title>{table ? `Table ${table.label}` : order.data?.guestName ? `No table · ${order.data.guestName}` : "No table"}</Title>
      {order.data ? <Body muted>{`${orderLabel(order.data)} · ${order.data.status}`}</Body> : <Body muted>The order starts when you add the first item.</Body>}
      <ErrorText>{order.error}</ErrorText>
      {order.data ? <Ticket order={order.data} names={names} onChange={order.apply} /> : null}
      {order.data === null || isOpenForItems(order.data) ? (
        <MenuPicker
          menu={offered}
          error={menu.error}
          onAdd={async (item) => {
            if (order.data) {
              const r = await call(
                api.POST("/orders/{id}/items", { params: { path: { id: order.data.id } }, body: [{ menuItemId: item.id, quantity: 1 }] }),
                "Could not add the item.",
              );
              if (r.ok) order.apply(r.data);
              return r;
            }
            // Opening a table creates nothing; the first item creates the order with that line.
            const r = await call(
              api.POST("/orders", { body: { tableId: params.tableId ?? null, items: [{ menuItemId: item.id, quantity: 1 }] } }),
              "Could not start the order.",
            );
            if (r.ok) router.replace(`/pos/order/${r.data.id}`);
            return r;
          }}
        />
      ) : null}
      {order.data ? <OrderActions order={order.data} onChange={order.apply} /> : null}
    </Screen>
  );
}

function Ticket({ order, names, onChange }: { order: Order; names: Map<string, string>; onChange: (o: Order) => void }) {
  const { api, user } = useSignedIn();
  const action = useAction();
  const [voiding, setVoiding] = useState<OrderItem | null>(null);

  async function setQuantity(line: OrderItem, quantity: number) {
    if (quantity < 1) return;
    const r = await action.run(() =>
      call(
        api.PATCH("/orders/{id}/items/{itemId}", {
          params: { path: { id: order.id, itemId: line.id } },
          body: { menuItemId: line.menuItemId, quantity, note: line.note },
        }),
        "Could not change the quantity.",
      ),
    );
    if (r.ok) onChange(r.data);
  }

  async function remove(line: OrderItem) {
    const r = await action.run(() =>
      call(api.DELETE("/orders/{id}/items/{itemId}", { params: { path: { id: order.id, itemId: line.id } } }), "Could not remove the item."),
    );
    if (r.ok) onChange(r.data);
  }

  return (
    <Card>
      {order.items.length === 0 ? <Body muted>No items.</Body> : null}
      {order.items.map((line) => (
        <View key={line.id} style={{ paddingVertical: 6, gap: 4, borderBottomColor: colors.creamFaint, borderBottomWidth: 1 }}>
          <Row style={{ justifyContent: "space-between" }}>
            <Body style={{ flex: 1 }}>
              {line.quantity}× {names.get(line.menuItemId) ?? "Item"}
            </Body>
            <Body muted>{formatBaht(line.unitPrice)}</Body>
          </Row>
          {line.note ? <Body muted>{line.note}</Body> : null}
          <Row>
            {line.sentAt ? <Badge text="Sent" color={colors.slate} /> : <Badge text="Not sent" color={colors.ink3} />}
            {canEditLine(order, line) ? (
              <>
                <Small title="−" onPress={() => void setQuantity(line, line.quantity - 1)} disabled={action.busy || line.quantity <= 1} />
                <Small title="+" onPress={() => void setQuantity(line, line.quantity + 1)} disabled={action.busy} />
                <Small title="Remove" onPress={() => void remove(line)} disabled={action.busy} />
              </>
            ) : null}
            {canVoidLine(order, line) && can(user, "pos.voidSentItem") ? <Small title="Void" onPress={() => setVoiding(line)} /> : null}
          </Row>
        </View>
      ))}
      {order.voids.length > 0 ? <Body muted>{`${order.voids.length} voided line(s)`}</Body> : null}
      <Row style={{ justifyContent: "space-between", paddingTop: 6 }}>
        <Label>Total</Label>
        {/* Order.total, as the server computed it - never summed here. */}
        <Text style={{ color: colors.cream, fontSize: 20, fontWeight: "700" }}>{formatBaht(order.total)}</Text>
      </Row>
      <ErrorText>{action.error}</ErrorText>
      {voiding ? <VoidDialog order={order} line={voiding} name={names.get(voiding.menuItemId) ?? "Item"} onClose={() => setVoiding(null)} onDone={onChange} /> : null}
    </Card>
  );
}

function Small({ title, onPress, disabled }: { title: string; onPress: () => void; disabled?: boolean }) {
  return (
    <Pressable
      role="button"
      disabled={disabled}
      onPress={onPress}
      hitSlop={6}
      style={{ minWidth: 44, minHeight: 36, borderRadius: 18, borderWidth: 1, borderColor: colors.creamFaint, alignItems: "center", justifyContent: "center", paddingHorizontal: 10, opacity: disabled ? 0.4 : 1 }}
    >
      <Text style={{ color: colors.cream, fontSize: 15 }}>{title}</Text>
    </Pressable>
  );
}

function VoidDialog({ order, line, name, onClose, onDone }: { order: Order; line: OrderItem; name: string; onClose: () => void; onDone: (o: Order) => void }) {
  const { api, user } = useSignedIn();
  const [quantity, setQuantity] = useState(line.quantity);
  const [reason, setReason] = useState("");
  const action = useAction();

  function submit() {
    const problem = validateVoidReason(reason);
    if (problem) {
      action.setError(problem);
      return;
    }
    confirmAsActor("Void a sent item", `Void ${quantity}× ${name}? The kitchen/bar gets a VOID ticket.`, user.name, async () => {
      const r = await action.run(() =>
        call(
          api.POST("/orders/{id}/items/{itemId}/void", { params: { path: { id: order.id, itemId: line.id } }, body: { quantity, reason: reason.trim() } }),
          "Could not void the item.",
        ),
      );
      if (r.ok) {
        onDone(r.data);
        onClose();
      }
    }, "Void");
  }

  return (
    <Modal transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.5)" }}>
        <View style={{ backgroundColor: colors.ink2, padding: 16, gap: 12, borderTopLeftRadius: 16, borderTopRightRadius: 16 }}>
          <Title>{`Void ${name}`}</Title>
          <Row>
            <Small title="−" onPress={() => setQuantity((q) => Math.max(1, q - 1))} disabled={quantity <= 1} />
            <Body>{`${quantity} of ${line.quantity}`}</Body>
            <Small title="+" onPress={() => setQuantity((q) => Math.min(line.quantity, q + 1))} disabled={quantity >= line.quantity} />
          </Row>
          <Field label="Reason (required)" value={reason} onChangeText={setReason} maxLength={500} />
          <ErrorText>{action.error}</ErrorText>
          <Button title="Void" variant="danger" onPress={submit} busy={action.busy} />
          <Button title="Keep it" variant="secondary" onPress={onClose} disabled={action.busy} />
        </View>
      </View>
    </Modal>
  );
}

function MenuPicker({ menu, error, onAdd }: { menu: MenuItem[]; error: string | null; onAdd: (item: MenuItem) => Promise<ApiResult<unknown>> }) {
  const categories = menuCategories(menu);
  const [category, setCategory] = useState<string | null>(null);
  const action = useAction();
  const shown = category ? menu.filter((m) => m.category === category) : [];
  return (
    <Card>
      <Label>Add items</Label>
      <ErrorText>{error}</ErrorText>
      <Choice options={categories.map((c) => ({ value: c, label: c }))} value={category} onChange={setCategory} />
      {category === null ? <Body muted>Pick a category.</Body> : null}
      {shown.map((item) => (
        <Pressable
          key={item.id}
          role="button"
          aria-label={`Add ${item.name}`}
          disabled={action.busy}
          onPress={() => void action.run(() => onAdd(item))}
          style={{ minHeight: 48, flexDirection: "row", justifyContent: "space-between", alignItems: "center", opacity: action.busy ? 0.5 : 1 }}
        >
          <Body>{item.name}</Body>
          <Body muted>{formatBaht(item.price)}</Body>
        </Pressable>
      ))}
      <ErrorText>{action.error}</ErrorText>
    </Card>
  );
}

function OrderActions({ order, onChange }: { order: Order; onChange: (o: Order) => void }) {
  const { api, user } = useSignedIn();
  const send = useAction();
  const prebill = useAction();
  const cancel = useAction();
  const [prebillNote, setPrebillNote] = useState<string | null>(null);
  const hasUnsent = order.items.some((i) => i.sentAt === null);

  if (isTerminal(order)) {
    return (
      <Card accent={order.status === "PAID" ? colors.green : colors.slate}>
        <Body>{order.status === "PAID" ? `Paid (${order.paymentMethod ?? ""}) — ${formatBaht(order.total)}` : "Cancelled"}</Body>
        {order.closedAt ? <Body muted>{formatTimestamp(order.closedAt)}</Body> : null}
      </Card>
    );
  }

  return (
    <>
      <Button
        title={order.status === "SENT" && !hasUnsent ? "Sent ✓" : "Send to kitchen/bar"}
        disabled={order.status !== "OPEN" || !hasUnsent}
        busy={send.busy}
        onPress={async () => {
          const r = await send.run(() =>
            call(api.PATCH("/orders/{id}", { params: { path: { id: order.id } }, body: { status: "SENT" } }), "Could not send the order."),
          );
          if (r.ok) onChange(r.data);
        }}
      />
      {order.status === "SENT" ? <Body muted>Items added now go to the kitchen/bar straight away.</Body> : null}
      <ErrorText>{send.error}</ErrorText>

      <Button
        title="Print pre-bill"
        variant="secondary"
        busy={prebill.busy}
        disabled={order.items.length === 0}
        onPress={async () => {
          setPrebillNote(null);
          const r = await prebill.run(() => call(api.POST("/orders/{id}/print-prebill", { params: { path: { id: order.id } } }), "Could not print."));
          if (r.ok) {
            setPrebillNote(
              !r.data.attempted
                ? "No cashier printer is set up."
                : r.data.job?.status === "SENT"
                  ? "Printed."
                  : `Not printed yet (${r.data.job?.status ?? "unknown"}) — see Printing.`,
            );
          }
        }}
      />
      {prebillNote ? <Body muted>{prebillNote}</Body> : null}
      <ErrorText>{prebill.error}</ErrorText>

      {can(user, "pos.takePayment") ? <Payment order={order} onChange={onChange} /> : null}

      <Button
        title="Cancel order"
        variant="danger"
        busy={cancel.busy}
        onPress={() =>
          confirmAsActor("Cancel order", `Cancel ${orderLabel(order)}? Nothing will be charged.`, user.name, async () => {
            const r = await cancel.run(() => call(api.POST("/orders/{id}/cancel", { params: { path: { id: order.id } } }), "Could not cancel the order."));
            if (r.ok) onChange(r.data);
          }, "Cancel order")
        }
      />
      <ErrorText>{cancel.error}</ErrorText>
    </>
  );
}

function Payment({ order, onChange }: { order: Order; onChange: (o: Order) => void }) {
  const { api, user } = useSignedIn();
  const shift = useLoad(async () => nullOn404(await call(api.GET("/shifts/current"), "Could not check your shift.")), [api]);
  const [method, setMethod] = useState<"CASH" | "CARD" | "ROOM_CHARGE" | null>(null);
  const [received, setReceived] = useState("");
  const [guestQuery, setGuestQuery] = useState("");
  const [booking, setBooking] = useState<Schemas["Booking"] | null>(null);
  const close = useAction();
  const search = useAction();
  const [results, setResults] = useState<Schemas["Booking"][] | null>(null);
  const change = cashChange(order.total, received);
  // Room service (and a spa bill opened from an appointment) already names the guest's booking:
  // offer it straight away instead of making the cashier search for someone the order knows.
  const linked = useLoad(
    async () =>
      order.bookingId
        ? nullOn404(await call(api.GET("/bookings/{id}", { params: { path: { id: order.bookingId } } }), "Could not load the guest's booking."))
        : { ok: true as const, data: null, status: 200 },
    [api, order.bookingId],
  );
  const linkedBooking = linked.data && isChargeableBooking(linked.data) ? linked.data : null;
  const shownResults = results ?? (linkedBooking ? [linkedBooking] : null);
  const chosen = booking ?? (results === null ? linkedBooking : null);

  if (shift.loading && shift.data === null && !shift.error) return <Loading label="Checking your shift…" />;
  if (shift.error) return <ErrorText>{shift.error}</ErrorText>;
  if (!shift.data) {
    return (
      <Card accent={colors.amber}>
        <Body>Open a cash shift before taking payment.</Body>
        <Button title="Go to cash shift" variant="secondary" onPress={() => router.push("/shift")} />
      </Card>
    );
  }

  function closeWith(body: Schemas["CloseOrderInput"], description: string) {
    confirmAsActor("Take payment", `${description} for ${orderLabel(order)}: ${formatBaht(order.total)}.`, user.name, async () => {
      const r = await close.run(() => call(api.POST("/orders/{id}/close", { params: { path: { id: order.id } }, body }), "Could not close the order."));
      if (r.ok) onChange(r.data);
    }, "Take payment");
  }

  return (
    <Card>
      <Label>Payment</Label>
      <Choice
        options={[
          { value: "CASH", label: "Cash" },
          { value: "CARD", label: "Card" },
          { value: "ROOM_CHARGE", label: "Charge to room" },
        ]}
        value={method}
        onChange={setMethod}
      />
      {method === "CASH" ? (
        <>
          <Field label="Cash received" value={received} onChangeText={setReceived} keyboardType="decimal-pad" />
          {received.trim() ? (
            change.ok ? (
              <Body>{`Change: ${formatBaht(change.change)}`}</Body>
            ) : (
              <ErrorText>{change.reason === "insufficient" ? `Short by ${formatBaht(change.short)}` : "Enter an amount like 500 or 500.50"}</ErrorText>
            )
          ) : null}
          <Button
            title="Take cash"
            disabled={!change.ok || order.items.length === 0}
            busy={close.busy}
            onPress={() => change.ok && closeWith({ method: "CASH", amountTendered: change.tendered }, `Cash, received ${formatBaht(change.tendered)}`)}
          />
        </>
      ) : null}
      {method === "CARD" ? (
        <Button title="Card payment taken" disabled={order.items.length === 0} busy={close.busy} onPress={() => closeWith({ method: "CARD" }, "Card")} />
      ) : null}
      {method === "ROOM_CHARGE" ? (
        <>
          <Field label="Guest name" value={guestQuery} onChangeText={setGuestQuery} />
          <Button
            title="Find in-house guest"
            variant="secondary"
            busy={search.busy}
            onPress={async () => {
              const today = hotelDateKey(new Date());
              const r = await search.run(() =>
                call(api.GET("/bookings", { params: { query: { from: today, to: today, guestName: guestQuery.trim() || undefined } } }), "Could not search bookings."),
              );
              if (r.ok) setResults(r.data.filter(isChargeableBooking));
            }}
          />
          <ErrorText>{search.error}</ErrorText>
          {shownResults?.length === 0 ? <Body muted>No confirmed or paid booking in house today matches.</Body> : null}
          {shownResults?.map((b) => (
            <Card key={b.id} onPress={() => setBooking(b)} accent={chosen?.id === b.id ? colors.sea : undefined}>
              <Body>{b.guestName}</Body>
              <Body muted>{`${b.roomUnit?.label ?? b.room.name} · ${formatDate(b.checkIn)} → ${formatDate(b.checkOut)}`}</Body>
            </Card>
          ))}
          <Button
            title="Charge to room"
            disabled={!chosen || order.items.length === 0}
            busy={close.busy}
            onPress={() => chosen && closeWith({ method: "ROOM_CHARGE", bookingId: chosen.id }, `Charge to ${chosen.guestName}'s room`)}
          />
        </>
      ) : null}
      <ErrorText>{close.error}</ErrorText>
    </Card>
  );
}
