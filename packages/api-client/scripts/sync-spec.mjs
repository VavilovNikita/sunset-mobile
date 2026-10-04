// Copies sunset's openapi.yaml into this package, then the caller runs `npm run generate`.
// The spec is vendored (not fetched at build time) so a build is reproducible and a spec change
// shows up as a reviewable diff here. Source: SUNSET_SPEC, or the sibling checkout's origin/master
// (run `git -C ../sunset fetch` first) - see upstreamSpec.mjs.
import { writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { normalizeEol, readUpstreamSpec } from "./upstreamSpec.mjs";

const spec = readUpstreamSpec();
if (!spec) {
  console.error("No sunset spec found - set SUNSET_SPEC=/path/to/sunset/openapi.yaml, or clone sunset next to this repo.");
  process.exit(1);
}
writeFileSync(resolve(dirname(fileURLToPath(import.meta.url)), "../openapi.yaml"), normalizeEol(spec.text));
console.log(`Copied ${spec.source} -> packages/api-client/openapi.yaml. Now run: npm run generate`);
