import { useState } from "react";
import { call } from "@sunset/api-client";
import type { Schemas } from "@sunset/api-client/staff";
import { formatBaht, formatTimestamp } from "@sunset/core";
import { Body, Button, Card, ErrorText, Field, Label, Loading, Row, Screen, Title } from "@sunset/ui";
import { RequireCapability } from "../../components/Guard";
import { confirmAsActor } from "../../components/ActorConfirm";
import { parseCashAmount } from "../../lib/cashInput";
import { nullOn404, useAction, useLoad } from "../../lib/hooks";
import { useSignedIn } from "../../lib/session";

export default function ShiftScreen() {
  return (
    <RequireCapability capability="shift.manage">
      <ShiftBody />
    </RequireCapability>
  );
}

function ShiftBody() {
  const { api, user } = useSignedIn();
  const current = useLoad(async () => nullOn404(await call(api.GET("/shifts/current"), "Could not load your shift.")), [api]);
  const summary = useLoad<Schemas["ShiftSummary"] | null>(
    async () =>
      current.data
        ? call(api.GET("/shifts/{id}", { params: { path: { id: current.data.id } } }), "Could not load the shift totals.")
        : { ok: true as const, status: 200, data: null },
    [api, current.data?.id],
    { pollMs: 30_000 },
  );
  const [float, setFloat] = useState("");
  const [counted, setCounted] = useState("");
  const [notes, setNotes] = useState("");
  const open = useAction();
  const close = useAction();

  if (current.loading && !current.data) return <Loading />;
  if (current.error) {
    return (
      <Screen>
        <ErrorText>{current.error}</ErrorText>
        <Button title="Try again" onPress={() => void current.reload()} />
      </Screen>
    );
  }

  if (!current.data) {
    const amount = parseCashAmount(float);
    return (
      <Screen>
        <Title>No open shift</Title>
        <Body muted>Count the cash float in the drawer before you start.</Body>
        <Field label="Opening cash float" value={float} onChangeText={setFloat} keyboardType="decimal-pad" />
        <Button
          title="Open shift"
          disabled={amount === null}
          busy={open.busy}
          onPress={() =>
            amount !== null &&
            confirmAsActor("Open cash shift", `Open a shift with a float of ${formatBaht(amount.toFixed(2))}.`, user.name, async () => {
              const r = await open.run(() => call(api.POST("/shifts/open", { body: { openingCashFloat: amount } }), "Could not open the shift."));
              if (r.ok) current.apply(r.data);
            }, "Open shift")
          }
        />
        <ErrorText>{open.error}</ErrorText>
      </Screen>
    );
  }

  const shift = current.data;
  const totals = summary.data?.totals;
  const countedAmount = parseCashAmount(counted);
  return (
    <Screen>
      <Title>Shift open</Title>
      <Body muted>{`Opened ${formatTimestamp(shift.openedAt)}`}</Body>
      <Card>
        <Row style={{ justifyContent: "space-between" }}>
          <Label>Opening float</Label>
          <Body>{formatBaht(shift.openingCashFloat ?? "0.00")}</Body>
        </Row>
        {totals ? (
          <>
            <Row style={{ justifyContent: "space-between" }}>
              <Label>Cash taken</Label>
              <Body>{formatBaht(totals.cash)}</Body>
            </Row>
            <Row style={{ justifyContent: "space-between" }}>
              <Label>Card</Label>
              <Body>{formatBaht(totals.card)}</Body>
            </Row>
            <Row style={{ justifyContent: "space-between" }}>
              <Label>Charged to rooms</Label>
              <Body>{formatBaht(totals.roomCharge)}</Body>
            </Row>
            <Body muted>{`${totals.paymentCount} payment(s)`}</Body>
          </>
        ) : null}
        <ErrorText>{summary.error}</ErrorText>
      </Card>
      <Body muted>
        Count the drawer and enter what is actually there. The server works out any difference and prints it on the Z report.
      </Body>
      <Field label="Cash counted" value={counted} onChangeText={setCounted} keyboardType="decimal-pad" />
      <Field label="Notes (optional)" value={notes} onChangeText={setNotes} maxLength={500} />
      <Button
        title="Close shift"
        variant="danger"
        disabled={countedAmount === null}
        busy={close.busy}
        onPress={() =>
          countedAmount !== null &&
          confirmAsActor("Close cash shift", `Close your shift with ${formatBaht(countedAmount.toFixed(2))} counted.`, user.name, async () => {
            const r = await close.run(() =>
              call(
                api.POST("/shifts/{id}/close", { params: { path: { id: shift.id } }, body: { closingCashCounted: countedAmount, notes: notes.trim() || null } }),
                "Could not close the shift.",
              ),
            );
            if (r.ok) {
              setCounted("");
              setNotes("");
              current.apply(null);
            }
          }, "Close shift")
        }
      />
      <ErrorText>{close.error}</ErrorText>
    </Screen>
  );
}
