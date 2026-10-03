import { useState } from "react";
import { useLocalSearchParams } from "expo-router";
import { call } from "@sunset/api-client";
import type { Schemas } from "@sunset/api-client/guest";
import { Body, ErrorText, Loading, Screen } from "@sunset/ui";
import { MenuCart, OrderSummary } from "../../components/MenuCart";
import { useAction, useLoad } from "../../lib/hooks";
import { useApi } from "../../lib/session";

/**
 * Room service for the guest's own CHECKED_IN booking. The server checks ownership and occupancy
 * on every call and answers 404 otherwise - e.g. once the guest has checked out.
 */
export default function RoomService() {
  const api = useApi();
  const { bookingId } = useLocalSearchParams<{ bookingId: string }>();
  const menu = useLoad(() => call(api.GET("/public/menu"), "Could not load the menu."), [api]);
  const [order, setOrder] = useState<Schemas["GuestOrderView"] | null>(null);
  const send = useAction();
  const [closed, setClosed] = useState(false);

  return (
    <Screen>
      {order ? <OrderSummary order={order} /> : null}
      {order ? <Body muted>Your order has gone to the kitchen/bar and will be charged to your room. Add more below.</Body> : null}
      {closed ? <ErrorText>Room service isn't available for this booking right now - it's only for guests who are checked in.</ErrorText> : null}
      <ErrorText>{menu.error}</ErrorText>
      {menu.loading && !menu.data ? <Loading /> : null}
      {menu.data && !closed ? (
        <MenuCart
          menu={menu.data}
          busy={send.busy}
          sendLabel={order ? "Add to my order" : "Send order"}
          onSend={async (lines) => {
            const r = await send.run(() =>
              order
                ? call(api.POST("/guest/orders/{id}/items", { params: { path: { id: order.id } }, body: lines }), "Could not add to your order.")
                : call(api.POST("/guest/orders", { body: { bookingId, items: lines } }), "Could not send your order."),
            );
            if (r.ok) setOrder(r.data);
            else if (r.status === 404) setClosed(true);
            return r.ok;
          }}
        />
      ) : null}
      <ErrorText>{send.error}</ErrorText>
    </Screen>
  );
}
