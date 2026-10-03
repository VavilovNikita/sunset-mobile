import { useState } from "react";
import { call } from "@sunset/api-client";
import { formatTimestamp } from "@sunset/core";
import { Badge, Body, Button, Card, Choice, ErrorText, Label, Loading, Row, Screen, colors } from "@sunset/ui";
import { RequireCapability } from "../../components/Guard";
import { can } from "../../lib/access";
import { useAction, useLoad } from "../../lib/hooks";
import { mergePrintJobLists, NOT_PRINTED_STATUSES, notPrintedBannerText, printerHealth, summarizeNotPrinted } from "../../lib/printQueue";
import { useSignedIn } from "../../lib/session";

const healthColor = { online: colors.green, offline: colors.coral, quiet: colors.amber, unknown: colors.slate } as const;

export default function PrintScreen() {
  return (
    <RequireCapability capability="print.queue">
      <PrintBody />
    </RequireCapability>
  );
}

function PrintBody() {
  const { api, user } = useSignedIn();
  const [filter, setFilter] = useState<"NOT_PRINTED" | "SENT">("NOT_PRINTED");
  const jobs = useLoad(
    async () => {
      const statuses = filter === "NOT_PRINTED" ? NOT_PRINTED_STATUSES : (["SENT"] as const);
      const results = await Promise.all(statuses.map((status) => call(api.GET("/print-jobs", { params: { query: { status } } }), "Could not load print jobs.")));
      const failed = results.find((r) => !r.ok);
      if (failed && !failed.ok) return failed;
      return { ok: true as const, status: 200, data: mergePrintJobLists(results.map((r) => (r.ok ? r.data : []))) };
    },
    [api, filter],
    { pollMs: 15_000 },
  );
  const printers = useLoad(
    async () => (can(user, "print.printers") ? call(api.GET("/printers"), "Could not load printers.") : { ok: true as const, status: 200, data: [] }),
    [api, user],
    { pollMs: 30_000 },
  );
  const retry = useAction();
  const [retrying, setRetrying] = useState<string | null>(null);
  const summary = jobs.data && filter === "NOT_PRINTED" ? summarizeNotPrinted(jobs.data) : null;

  return (
    <Screen>
      {can(user, "print.printers") ? (
        <Card>
          <Label>Printers</Label>
          <ErrorText>{printers.error}</ErrorText>
          {(printers.data ?? [])
            .filter((p) => p.isActive)
            .map((p) => {
              const health = printerHealth(p, new Date());
              return (
                <Row key={p.id} style={{ justifyContent: "space-between" }}>
                  <Body style={{ flex: 1 }}>{`${p.name} (${p.department.toLowerCase()})`}</Body>
                  <Badge text={health.state} color={healthColor[health.state]} />
                </Row>
              );
            })}
        </Card>
      ) : null}

      <Choice
        options={[
          { value: "NOT_PRINTED", label: "Not printed" },
          { value: "SENT", label: "Printed" },
        ]}
        value={filter}
        onChange={setFilter}
      />
      {summary ? <Body>{summary.total === 0 ? "Nothing waiting — every print job has printed." : notPrintedBannerText(summary)}</Body> : null}
      <ErrorText>{jobs.error}</ErrorText>
      {jobs.loading && !jobs.data ? <Loading /> : null}
      {(jobs.data ?? []).map((job) => (
        <Card key={job.id} accent={job.status === "SENT" ? colors.green : job.status === "FAILED" ? colors.coral : colors.amber}>
          <Row style={{ justifyContent: "space-between" }}>
            <Badge text={job.status} color={job.status === "SENT" ? colors.green : job.status === "FAILED" ? colors.coral : colors.amber} />
            <Body muted>{formatTimestamp(job.createdAt)}</Body>
          </Row>
          <Body>{job.summary}</Body>
          <Body muted>{`${job.documentType.replace(/_/g, " ").toLowerCase()} · ${job.attempts} attempt(s)`}</Body>
          {job.lastError ? <Body muted>{job.lastError}</Body> : null}
          {job.status !== "SENT" ? (
            <Button
              title="Retry now"
              variant="secondary"
              busy={retry.busy && retrying === job.id}
              disabled={retry.busy}
              onPress={async () => {
                setRetrying(job.id);
                const r = await retry.run(() => call(api.POST("/print-jobs/{id}/retry", { params: { path: { id: job.id } } }), "Could not retry."));
                setRetrying(null);
                if (r.ok) void jobs.reload();
              }}
            />
          ) : null}
        </Card>
      ))}
      <ErrorText>{retry.error}</ErrorText>
    </Screen>
  );
}
