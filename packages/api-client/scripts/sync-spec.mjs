// Copies sunset's openapi.yaml into this package, then the caller runs `npm run generate`.
// The spec is vendored (not fetched at build time) so a build is reproducible and a spec change
// shows up as a reviewable diff here. Source: SUNSET_SPEC env var, or a sibling `sunset` checkout.
import { copyFileSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const source = process.env.SUNSET_SPEC ?? resolve(here, "../../../../sunset/openapi.yaml");
if (!existsSync(source)) {
  console.error(`No spec at ${source} - set SUNSET_SPEC=/path/to/sunset/openapi.yaml`);
  process.exit(1);
}
copyFileSync(source, resolve(here, "../openapi.yaml"));
console.log(`Copied ${source} -> packages/api-client/openapi.yaml. Now run: npm run generate`);
