import { useCallback, useEffect, useState } from "react";
import { router } from "expo-router";
import { call } from "@sunset/api-client";
import type { Schemas } from "@sunset/api-client/guest";
import { Body, Button, ErrorText, Loading, Screen, Title } from "@sunset/ui";
import { MenuCart, OrderSummary } from "../../components/MenuCart";
import { useAction, useLoad } from "../../lib/hooks";
import { ENDED_MESSAGE, orderSessionState, type OrderQr } from "../../lib/orderQr";
import { forgetTableOrder, loadTableOrder } from "../../lib/qrSession";
import { useApi } from "../../lib/session";

/**
 * Dine-in ordering from a scanned table code - the same rules as the web QR flow: no account, the
 * code's token is the whole credential, and it stops working the moment the order leaves
 * OPEN/SENT (the server then answers 404 for everything, and the code is forgotten here).
 */
export default function TableOrder() {
  const [qr, setQr] = useState<OrderQr | null | undefined>(undefined);
  useEffect(() => {
    void loadTableOrder().then(setQr);
  }, []);

  if (qr === undefined) return <Loading />;
  if (qr === null) {
    return (
      <Screen>
        <Body muted>Scan the QR code on your table to see your order and add to it.</Body>
        <Button title="Scan the table's code" onPress={() => router.push("/table/scan")} />
      </Screen>
    );
  }
  return <Session qr={qr} onEnded={() => setQr(null)} />;
}

function Session({ qr, onEnded }: { qr: OrderQr; onEnded: () => void }) {
  const api = useApi();
  const [ended, setEnded] = useState(false);
  const menu = useLoad(() => call(api.GET("/public/menu"), "Could not load the menu."), [api]);

  const end = useCallback(async () => {
    setEnded(true);
    await forgetTableOrder();
  }, []);

  // Polled every 15s. Only a 404 ends the session (the order was paid or cancelled, or the code
  // was never valid); a dropped connection or a server error leaves it alone and just says so.
  const order = useLoad<Schemas["GuestOrderView"]>(
    async () => {
      const r = await call(api.GET("/public/orders/{id}", { params: { path: { id: qr.orderId }, query: { token: qr.token } } }), "Could not load your order.");
      if (orderSessionState(r) === "ended") await end();
      return r;
    },
    [api, qr.orderId, qr.token, end],
    { pollMs: ended ? undefined : 15_000 },
  );
  const send = useAction();

  if (ended) {
    return (
      <Screen>
        <Body>{ENDED_MESSAGE}</Body>
        <Button
          title="Scan a new code"
          onPress={() => {
            onEnded();
            router.push("/table/scan");
          }}
        />
      </Screen>
    );
  }

  return (
    <Screen>
      <Title>Your table</Title>
      {order.data ? <OrderSummary order={order.data} /> : null}
      {order.loading && !order.data ? <Loading /> : null}
      <ErrorText>{order.error}</ErrorText>
      <ErrorText>{menu.error}</ErrorText>
      {menu.data && order.data ? (
        <MenuCart
          menu={menu.data}
          busy={send.busy}
          sendLabel="Send to the kitchen/bar"
          onSend={async (lines) => {
            const r = await send.run(() =>
              call(api.POST("/public/orders/{id}/items", { params: { path: { id: qr.orderId }, query: { token: qr.token } }, body: lines }), "Could not send your order."),
            );
            if (r.ok) order.apply(r.data);
            else if (orderSessionState(r) === "ended") await end();
            return r.ok;
          }}
        />
      ) : null}
      <ErrorText>{send.error}</ErrorText>
    </Screen>
  );
}
