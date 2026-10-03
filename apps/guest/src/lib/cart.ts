/**
 * Items a guest has picked but not yet sent. Deliberately has no total: the price of an order is
 * whatever the server computes when the items are added (sunset CLAUDE.md "Money") - the app shows
 * each item's listed price and then the server's total in the response, never a sum of its own.
 */
export type CartLine = { menuItemId: string; quantity: number };

export const MAX_LINE_QUANTITY = 20;

export function addToCart(cart: CartLine[], menuItemId: string): CartLine[] {
  const existing = cart.find((l) => l.menuItemId === menuItemId);
  if (!existing) return [...cart, { menuItemId, quantity: 1 }];
  return cart.map((l) => (l.menuItemId === menuItemId ? { ...l, quantity: Math.min(MAX_LINE_QUANTITY, l.quantity + 1) } : l));
}

export function removeFromCart(cart: CartLine[], menuItemId: string): CartLine[] {
  return cart.flatMap((l) => (l.menuItemId !== menuItemId ? [l] : l.quantity > 1 ? [{ ...l, quantity: l.quantity - 1 }] : []));
}

export function cartCount(cart: CartLine[]): number {
  return cart.reduce((n, l) => n + l.quantity, 0);
}
