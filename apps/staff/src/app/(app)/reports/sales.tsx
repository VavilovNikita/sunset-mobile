import { useState } from "react";
import { call } from "@sunset/api-client";
import { formatBaht, hotelDateKey } from "@sunset/core";
import { Body, Card, ErrorText, Label, Loading, Screen } from "@sunset/ui";
import { RequireCapability } from "../../../components/Guard";
import { MonthStepper, Stat } from "../../../components/ReportBits";
import { monthOf, monthRange } from "../../../lib/reports";
import { useLoad } from "../../../lib/hooks";
import { useSignedIn } from "../../../lib/session";

export default function Sales() {
  return (
    <RequireCapability capability="reports">
      <SalesBody />
    </RequireCapability>
  );
}

/** GET /reports/pos-sales-mix - the server's own breakdowns, in the server's order. */
function SalesBody() {
  const { api } = useSignedIn();
  const [ym, setYm] = useState(monthOf(hotelDateKey(new Date())));
  const { from, to } = monthRange(ym);
  const report = useLoad(() => call(api.GET("/reports/pos-sales-mix", { params: { query: { from, to } } }), "Could not load sales."), [api, from, to]);
  const r = report.data;
  return (
    <Screen>
      <MonthStepper value={ym} onChange={setYm} />
      <ErrorText>{report.error}</ErrorText>
      {report.loading && !r ? <Loading /> : null}
      {r ? (
        <>
          <Card>
            <Stat label="Items sold" value={String(r.totalQuantity)} />
            <Stat label="Revenue" value={formatBaht(r.totalRevenue)} />
          </Card>
          <Card>
            <Label>By department</Label>
            {r.departments.map((d) => (
              <Stat key={d.department} label={`${d.department.toLowerCase()} · ${d.quantity}`} value={formatBaht(d.revenue)} />
            ))}
          </Card>
          <Card>
            <Label>By category</Label>
            {r.categories.map((c) => (
              <Stat key={c.category} label={`${c.category} · ${c.quantity}`} value={formatBaht(c.revenue)} />
            ))}
          </Card>
          <Card>
            <Label>By item</Label>
            {r.items.length === 0 ? <Body muted>Nothing sold this month.</Body> : null}
            {r.items.map((i) => (
              <Stat key={i.menuItemId} label={`${i.name} · ${i.quantity}`} value={formatBaht(i.revenue)} />
            ))}
          </Card>
        </>
      ) : null}
    </Screen>
  );
}
