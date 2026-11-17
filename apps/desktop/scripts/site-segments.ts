import { resolve } from "node:path";
import { generateSiteSegments } from "../../site/scripts/generate-site-segments.ts";

await generateSiteSegments({
  check: false,
  output: resolve(import.meta.dirname, "../src/site-segments.ts"),
});
