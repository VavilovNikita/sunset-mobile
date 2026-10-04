import { call } from "@sunset/api-client";
import type { Schemas } from "@sunset/api-client/staff";
import { formatTimestamp } from "@sunset/core";
import { Body, Button, Card, ErrorText, Loading, Row, Screen, Toggle, colors } from "@sunset/ui";
import { useState } from "react";
import { RequireCapability } from "../../../components/Guard";
import { useAction, useLoad } from "../../../lib/hooks";
import { useSignedIn } from "../../../lib/session";

type Printer = Schemas["Printer"];

export default function Printers() {
  return (
    <RequireCapability capability="settings.manage">
      <PrintersBody />
    </RequireCapability>
  );
}

/** Kitchen/bar/cashier printers: last success and failure, on/off, and a test print. Address changes stay on the web. */
function PrintersBody() {
  const { api } = useSignedIn();
  const printers = useLoad(() => call(api.GET("/printers"), "Could not load printers."), [api]);
  const write = useAction();
  const [result, setResult] = useState<Record<string, string>>({});

  async function setActive(p: Printer, isActive: boolean) {
    const r = await write.run(() =>
      call(api.PATCH("/printers/{id}", { params: { path: { id: p.id } }, body: { name: p.name, department: p.department, host: p.host, port: p.port, codepage: p.codepage, isActive } }), "Could not save the printer."),
    );
    if (r.ok && printers.data) printers.apply(printers.data.map((x) => (x.id === r.data.id ? r.data : x)));
  }
  async function test(p: Printer) {
    const r = await write.run(() => call(api.POST("/printers/{id}/test", { params: { path: { id: p.id } } }), "Could not send a test print."));
    if (r.ok) setResult((m) => ({ ...m, [p.id]: r.data.status === "SENT" ? "Test page printed." : `Not printed (${r.data.status.toLowerCase()})${r.data.lastError ? `: ${r.data.lastError}` : ""}` }));
  }

  const failingLast = (p: Printer) => !!p.lastFailedAt && (!p.lastSentAt || p.lastFailedAt > p.lastSentAt);
  return (
    <Screen>
      <ErrorText>{printers.error}</ErrorText>
      <ErrorText>{write.error}</ErrorText>
      {printers.loading && !printers.data ? <Loading /> : null}
      {printers.data?.length === 0 ? <Body muted>No printers are set up.</Body> : null}
      {printers.data?.map((p) => (
        <Card key={p.id} accent={!p.isActive ? colors.ink3 : failingLast(p) ? colors.coral : colors.sea}>
          <Row style={{ justifyContent: "space-between" }}>
            <Body>{p.name}</Body>
            <Body muted>{p.department.toLowerCase()}</Body>
          </Row>
          <Body muted>{`${p.host}:${p.port}`}</Body>
          <Body muted>{`Last printed: ${p.lastSentAt ? formatTimestamp(p.lastSentAt) : "never"}${p.lastFailedAt ? ` · last failed: ${formatTimestamp(p.lastFailedAt)}` : ""}`}</Body>
          <Toggle label={p.isActive ? "In use" : "Switched off"} value={p.isActive} disabled={write.busy} onChange={(v) => void setActive(p, v)} />
          <Button title="Test print" variant="secondary" disabled={write.busy || !p.isActive} onPress={() => void test(p)} />
          {result[p.id] ? <Body>{result[p.id]}</Body> : null}
        </Card>
      ))}
    </Screen>
  );
}
