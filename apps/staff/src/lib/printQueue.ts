import { formatTimestamp } from "@sunset/core";
import type { Schemas } from "@sunset/api-client/staff";

type PrintJob = Schemas["PrintJob"];
type Printer = Schemas["Printer"];

// Ported unchanged from sunset-beach lib/printQueue.ts and lib/printerHealth.ts - the same
// rules, not new ones. "Not printed" is FAILED + PENDING: a PENDING job has already failed at
// least one attempt (a first attempt that works goes straight to SENT), and it only turns FAILED
// after its last automatic retry, minutes later. Every counter uses this one rule.
export const NOT_PRINTED_STATUSES: PrintJob["status"][] = ["FAILED", "PENDING"];

export function mergePrintJobLists(lists: PrintJob[][]): PrintJob[] {
  const byId = new Map<string, PrintJob>();
  for (const list of lists) for (const job of list) byId.set(job.id, job);
  return [...byId.values()].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
}

export type NotPrintedSummary = { total: number; retrying: number };

export function summarizeNotPrinted(jobs: PrintJob[]): NotPrintedSummary {
  const open = jobs.filter((j) => NOT_PRINTED_STATUSES.includes(j.status) && !j.dismissedAt);
  return { total: open.length, retrying: open.filter((j) => j.status === "PENDING").length };
}

export function notPrintedBannerText({ total, retrying }: NotPrintedSummary): string {
  const still = retrying > 0 ? ` (${retrying} still retrying)` : "";
  return `${total} print ${total === 1 ? "job" : "jobs"} not printed${still} — a ticket may not have reached the kitchen/bar`;
}

export type PrinterHealthState = "online" | "offline" | "quiet" | "unknown";

export const PRINTER_QUIET_AFTER_MS = 24 * 60 * 60 * 1000;

/** From the printer's last successful and last failed send, as the server records them - no extra polling of the printer itself. */
export function printerHealth(printer: Pick<Printer, "lastSentAt" | "lastFailedAt">, now: Date): { state: PrinterHealthState; label: string } {
  const sent = printer.lastSentAt ? Date.parse(printer.lastSentAt) : null;
  const failed = printer.lastFailedAt ? Date.parse(printer.lastFailedAt) : null;
  if (failed !== null && (sent === null || failed > sent)) {
    const lastPrinted = printer.lastSentAt ? `; last printed ${formatTimestamp(printer.lastSentAt)}` : "";
    return { state: "offline", label: `Not answering — last attempt failed ${formatTimestamp(printer.lastFailedAt!)}${lastPrinted}` };
  }
  if (sent === null) return { state: "unknown", label: "Never printed — use Test print on the admin site to check it" };
  if (now.getTime() - sent > PRINTER_QUIET_AFTER_MS) {
    return { state: "quiet", label: `Last printed ${formatTimestamp(printer.lastSentAt!)} — nothing since` };
  }
  return { state: "online", label: `Online — last printed ${formatTimestamp(printer.lastSentAt!)}` };
}
