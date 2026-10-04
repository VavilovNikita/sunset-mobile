// Where "sunset's spec" comes from, shared by sync-spec.mjs and test/spec-sync.test.ts so the two
// can't disagree. SUNSET_SPEC (a file path) wins. Otherwise the sibling `sunset` checkout's
// origin/master - read through git, not the working tree, because that checkout is usually on some
// feature branch whose unmerged spec changes this client must not pick up (or be failed by).
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const sibling = resolve(dirname(fileURLToPath(import.meta.url)), "../../../../sunset");

/** @returns {{ text: string, source: string } | null} null when there is nothing to compare against. */
export function readUpstreamSpec() {
  const override = process.env.SUNSET_SPEC;
  if (override) return existsSync(override) ? { text: readFileSync(override, "utf8"), source: override } : null;
  if (!existsSync(resolve(sibling, ".git"))) return null;
  try {
    const text = execFileSync("git", ["-C", sibling, "show", "origin/master:openapi.yaml"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], maxBuffer: 64 * 1024 * 1024 });
    return { text, source: `${sibling} origin/master` };
  } catch {
    return null;
  }
}

/** Line endings are a checkout setting (core.autocrlf), not content. */
export const normalizeEol = (text) => text.replace(/\r\n/g, "\n");
