import { useMemo, useState } from "react";
import { Pressable, Text, View } from "react-native";
import type { Schemas } from "@sunset/api-client/guest";
import { formatBaht } from "@sunset/core";
import { Body, Button, Card, Choice, Label, Row, colors } from "@sunset/ui";
import { addToCart, cartCount, removeFromCart, type CartLine } from "../lib/cart";

type MenuItem = Schemas["MenuItem"];

/**
 * Pick items, then send them. Each item shows its listed price; there is no running total - the
 * total is the server's, shown once the items are on the order.
 */
export function MenuCart({ menu, busy, onSend, sendLabel }: { menu: MenuItem[]; busy: boolean; onSend: (lines: CartLine[]) => Promise<boolean>; sendLabel: string }) {
  const categories = useMemo(() => [...new Set(menu.map((m) => m.category))].sort(), [menu]);
  const [category, setCategory] = useState<string | null>(null);
  const [cart, setCart] = useState<CartLine[]>([]);
  const names = useMemo(() => new Map(menu.map((m) => [m.id, m])), [menu]);
  const shown = category ? menu.filter((m) => m.category === category) : [];

  return (
    <View style={{ gap: 12 }}>
      <Choice options={categories.map((c) => ({ value: c, label: c }))} value={category} onChange={setCategory} />
      {shown.map((item) => {
        const qty = cart.find((l) => l.menuItemId === item.id)?.quantity ?? 0;
        return (
          <Card key={item.id}>
            <Row style={{ justifyContent: "space-between" }}>
              <Body style={{ flex: 1 }}>{item.name}</Body>
              <Body muted>{formatBaht(item.price)}</Body>
            </Row>
            {item.description ? <Body muted>{item.description}</Body> : null}
            <Row>
              <Step label="−" onPress={() => setCart((c) => removeFromCart(c, item.id))} disabled={qty === 0} />
              <Text style={{ color: colors.cream, minWidth: 24, textAlign: "center" }}>{qty}</Text>
              <Step label="+" onPress={() => setCart((c) => addToCart(c, item.id))} />
            </Row>
          </Card>
        );
      })}
      {cart.length > 0 ? (
        <Card accent={colors.sea}>
          <Label>Your selection</Label>
          {cart.map((l) => (
            <Body key={l.menuItemId}>{`${l.quantity}× ${names.get(l.menuItemId)?.name ?? "Item"}`}</Body>
          ))}
          <Body muted>The total is confirmed once the order is sent.</Body>
        </Card>
      ) : null}
      <Button
        title={cartCount(cart) > 0 ? `${sendLabel} (${cartCount(cart)})` : sendLabel}
        disabled={cart.length === 0}
        busy={busy}
        onPress={async () => {
          if (await onSend(cart)) setCart([]);
        }}
      />
    </View>
  );
}

function Step({ label, onPress, disabled }: { label: string; onPress: () => void; disabled?: boolean }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label === "+" ? "Add one" : "Remove one"}
      disabled={disabled}
      onPress={onPress}
      style={{ width: 48, height: 40, borderRadius: 20, borderWidth: 1, borderColor: colors.creamFaint, alignItems: "center", justifyContent: "center", opacity: disabled ? 0.4 : 1 }}
    >
      <Text style={{ color: colors.cream, fontSize: 18 }}>{label}</Text>
    </Pressable>
  );
}

/** The server's view of an order: its lines and its own total. */
export function OrderSummary({ order }: { order: Schemas["GuestOrderView"] }) {
  return (
    <Card>
      <Label>{order.locationLabel}</Label>
      {order.items.map((i, idx) => (
        <Row key={idx} style={{ justifyContent: "space-between" }}>
          <Body style={{ flex: 1 }}>{`${i.quantity}× ${i.name}`}</Body>
          <Body muted>{formatBaht(i.unitPrice)}</Body>
        </Row>
      ))}
      <Row style={{ justifyContent: "space-between" }}>
        <Label>Total</Label>
        <Text style={{ color: colors.cream, fontSize: 18, fontWeight: "700" }}>{formatBaht(order.total)}</Text>
      </Row>
    </Card>
  );
}
