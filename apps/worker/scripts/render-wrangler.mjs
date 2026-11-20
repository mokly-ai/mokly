import { writeFileSync } from "node:fs";

const testMode = process.argv.includes("--test");
const domain = testMode ? "example.invalid" : process.env.MKC_DOMAIN;
const zoneId = testMode
  ? "00000000000000000000000000000000"
  : process.env.MKC_CLOUDFLARE_ZONE_ID;
const domainPattern =
  /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)*\.[a-z]{2,63}$/;
const zoneIdPattern = /^[0-9a-f]{32}$/;

if (!domain || domain.length > 253 || !domainPattern.test(domain)) {
  throw new Error("MKC_DOMAIN must be a lowercase DNS domain");
}
if (!zoneId || !zoneIdPattern.test(zoneId)) {
  throw new Error("MKC_CLOUDFLARE_ZONE_ID must be 32 lowercase hex characters");
}

const configuration = {
  $schema: "../../node_modules/wrangler/config-schema.json",
  name: "mokly-cloud-origin-router",
  main: "src/index.ts",
  compatibility_date: "2026-03-01",
  workers_dev: false,
  preview_urls: false,
  vars: { DOMAIN: domain },
  routes: [
    { pattern: `${domain}/*`, zone_id: zoneId },
    { pattern: `*.preview.${domain}/*`, zone_id: zoneId },
  ],
};

writeFileSync(
  new URL(
    testMode ? "../wrangler.test.json" : "../wrangler.json",
    import.meta.url,
  ),
  `${JSON.stringify(configuration, null, 2)}\n`,
);
