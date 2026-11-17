import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import {
  cpSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, test } from "node:test";
import { fileURLToPath } from "node:url";

const source = fileURLToPath(
  new URL("../scripts/render-wrangler.mjs", import.meta.url),
);
let fixtureRoot;

afterEach(() => {
  rmSync(fixtureRoot, { force: true, recursive: true });
});

function fixtureScript() {
  fixtureRoot = mkdtempSync(join(tmpdir(), "mkc-worker-config-"));
  const scripts = join(fixtureRoot, "scripts");
  mkdirSync(scripts);
  const script = join(scripts, "render-wrangler.mjs");
  cpSync(source, script);
  return script;
}

test("renders every route against the validated zone ID", () => {
  const script = fixtureScript();
  const zoneId = "0123456789abcdef0123456789abcdef";
  execFileSync(process.execPath, [script], {
    env: {
      ...process.env,
      MKC_CLOUDFLARE_ZONE_ID: zoneId,
      MKC_DOMAIN: "example.com",
    },
  });

  const config = JSON.parse(
    readFileSync(join(fixtureRoot, "wrangler.json"), "utf8"),
  );
  assert.deepEqual(config.routes, [
    { pattern: "example.com/*", zone_id: zoneId },
    { pattern: "*.preview.example.com/*", zone_id: zoneId },
  ]);
});

test("rejects a zone ID that is not 32 lowercase hex characters", () => {
  const script = fixtureScript();
  for (const zoneId of [
    "abcdef",
    "ABCDEF0123456789abcdef0123456789",
    "g123456789abcdef0123456789abcdef",
  ]) {
    const result = spawnSync(process.execPath, [script], {
      encoding: "utf8",
      env: {
        ...process.env,
        MKC_CLOUDFLARE_ZONE_ID: zoneId,
        MKC_DOMAIN: "example.com",
      },
    });
    assert.notEqual(result.status, 0);
    assert.match(
      result.stderr,
      /MKC_CLOUDFLARE_ZONE_ID must be 32 lowercase hex characters/,
    );
  }
});

test("test rendering leaves the deployment configuration untouched", () => {
  const script = fixtureScript();
  const deployConfig = join(fixtureRoot, "wrangler.json");
  writeFileSync(deployConfig, "operator configuration\n");

  execFileSync(process.execPath, [script, "--test"]);

  assert.equal(readFileSync(deployConfig, "utf8"), "operator configuration\n");
  assert.equal(
    JSON.parse(readFileSync(join(fixtureRoot, "wrangler.test.json"), "utf8"))
      .vars.DOMAIN,
    "example.invalid",
  );
});
