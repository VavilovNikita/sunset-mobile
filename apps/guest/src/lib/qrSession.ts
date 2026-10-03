import * as SecureStore from "expo-secure-store";
import type { OrderQr } from "./orderQr";

// The scanned table's code is a bearer credential for adding to that order, so it lives in secure
// storage too, and is forgotten as soon as the server says the order is closed.
const KEY = "sunset.guest.tableOrder";

export async function saveTableOrder(qr: OrderQr): Promise<void> {
  await SecureStore.setItemAsync(KEY, JSON.stringify(qr));
}

export async function loadTableOrder(): Promise<OrderQr | null> {
  const raw = await SecureStore.getItemAsync(KEY).catch(() => null);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<OrderQr>;
    return parsed.orderId && parsed.token ? { orderId: parsed.orderId, token: parsed.token } : null;
  } catch {
    return null;
  }
}

export async function forgetTableOrder(): Promise<void> {
  await SecureStore.deleteItemAsync(KEY).catch(() => undefined);
}
