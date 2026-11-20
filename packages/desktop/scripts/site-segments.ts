import { resolve } from "node:path";

import { generateSiteSegments } from "../../../apps/site/scripts/generate-site-segments.ts";

await generateSiteSegments({
  check: false,
  output: resolve(import.meta.dirname, "../src/site-segments.ts"),
});
