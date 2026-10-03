import { router } from "expo-router";
import { call } from "@sunset/api-client";
import { Card, Body, colors } from "@sunset/ui";
import { useLoad } from "../lib/hooks";
import { mergePrintJobLists, notPrintedBannerText, summarizeNotPrinted } from "../lib/printQueue";
import { useSignedIn } from "../lib/session";

/**
 * "Not printed" = FAILED + PENDING, the one rule every counter uses (sunset-beach lib/printQueue.ts).
 * Reads the existing print-job queue on the same 30s cadence as the web banner; it's secondary
 * data, so a failure here never takes the screen down - it just says so.
 */
export function NotPrintedBanner() {
  const { api } = useSignedIn();
  const jobs = useLoad(
    async () => {
      const [failed, pending] = await Promise.all([
        call(api.GET("/print-jobs", { params: { query: { status: "FAILED" } } }), "Could not check the print queue."),
        call(api.GET("/print-jobs", { params: { query: { status: "PENDING" } } }), "Could not check the print queue."),
      ]);
      if (!failed.ok) return failed;
      if (!pending.ok) return pending;
      return { ok: true as const, status: 200, data: mergePrintJobLists([failed.data, pending.data]) };
    },
    [api],
    { pollMs: 30_000 },
  );
  if (jobs.error) return <Body muted>Print status unavailable: {jobs.error}</Body>;
  if (!jobs.data) return null;
  const summary = summarizeNotPrinted(jobs.data);
  if (summary.total === 0) return null;
  return (
    <Card accent={colors.coral} onPress={() => router.push("/print")}>
      <Body>{notPrintedBannerText(summary)}</Body>
    </Card>
  );
}
