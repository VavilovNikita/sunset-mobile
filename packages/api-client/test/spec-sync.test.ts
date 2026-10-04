import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { createRequire } from "node:module";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { normalizeEol, readUpstreamSpec } from "../scripts/upstreamSpec.mjs";

const pkg = resolve(import.meta.dirname, "..");
const require = createRequire(import.meta.url);

describe("generated types match the spec", () => {
  it("src/schema.ts is exactly what openapi-typescript produces from the vendored openapi.yaml", () => {
    // Hand-edited or stale generated types are how the web client's hand-mirrored types drifted
    // from the spec (audit finding M7). Regenerate and compare byte for byte.
    const out = join(mkdtempSync(join(tmpdir(), "api-client-")), "schema.ts");
    execFileSync(process.execPath, [join(require.resolve("openapi-typescript"), "../../bin/cli.js"), "openapi.yaml", "-o", out, "--default-non-nullable", "false"], {
      cwd: pkg,
      stdio: "pipe",
    });
    expect(normalizeEol(readFileSync(out, "utf8"))).toBe(normalizeEol(readFileSync(join(pkg, "src/schema.ts"), "utf8")));
  });

  // sunset's origin/master (or SUNSET_SPEC) - never whatever branch the sibling checkout is on.
  const upstream = readUpstreamSpec();
  it.skipIf(!upstream)("the vendored openapi.yaml is the same as sunset's master (when a checkout is available)", () => {
    expect(normalizeEol(readFileSync(join(pkg, "openapi.yaml"), "utf8"))).toBe(normalizeEol(upstream!.text));
  });
});
