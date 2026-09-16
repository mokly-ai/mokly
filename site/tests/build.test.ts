import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import test from "node:test";
import { promisify } from "node:util";

const root = path.resolve(import.meta.dirname, "..");
const manifestPath = createRequire(import.meta.url).resolve(
  "astro/package.json",
);
const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as {
  bin: { astro: string };
};
const astro = path.join(path.dirname(manifestPath), manifest.bin.astro);

for (const [setting, value] of [
  ["SITE_APP_ORIGIN", "https://example.com/path"],
  ["SITE_ORIGIN", "invalid"],
  ["SITE_STAGE_PR", "0"],
  ["SITE_STAGE_PR", undefined],
] as const) {
  test(`Astro build fails for ${setting}=${String(value)}`, async () => {
    const environment = {
      ...process.env,
      SITE_APP_ORIGIN: "https://app.example.com",
      SITE_ORIGIN: "https://example.com",
      SITE_STAGE_PR: "71",
    };
    if (value === undefined) delete (environment as NodeJS.ProcessEnv)[setting];
    else environment[setting] = value;
    await assert.rejects(
      promisify(execFile)(process.execPath, [astro, "build"], {
        cwd: root,
        env: environment,
        timeout: 30_000,
      }),
      (error: Error & { code?: number; stderr?: string }) => {
        assert.equal(error.code, 1);
        assert.match(error.stderr ?? "", new RegExp(setting));
        return true;
      },
    );
  });
}
