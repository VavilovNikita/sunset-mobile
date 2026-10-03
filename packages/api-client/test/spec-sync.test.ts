import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { createRequire } from "node:module";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const pkg = resolve(import.meta.dirname, "..");
const require = createRequire(import.meta.url);

describe("generated types match the spec", () => {
  it("src/schema.ts is exactly what openapi-typescript produces from the vendored openapi.yaml", () => {
    // Hand-edited or stale generated types are how the web client's hand-mirrored types drifted
    // from the spec (audit finding M7). Regenerate and compare byte for byte.
    const out = join(mkdtempSync(join(tmpdir(), "api-client-")), "schema.ts");
    execFileSync(process.execPath, [join(require.resolve("openapi-typescript"), "../../bin/cli.js"), "openapi.yaml", "-o", out], {
      cwd: pkg,
      stdio: "pipe",
    });
    expect(readFileSync(out, "utf8")).toBe(readFileSync(join(pkg, "src/schema.ts"), "utf8"));
  });

  const upstream = process.env.SUNSET_SPEC ?? resolve(pkg, "../../../sunset/openapi.yaml");
  it.skipIf(!existsSync(upstream))("the vendored openapi.yaml is the same as sunset's (when a checkout is available)", () => {
    expect(readFileSync(join(pkg, "openapi.yaml"), "utf8")).toBe(readFileSync(upstream, "utf8"));
  });
});
