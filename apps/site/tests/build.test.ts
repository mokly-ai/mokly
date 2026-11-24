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

for (const [setting, value] of [["SITE_ORIGIN", "invalid"]] as const) {
  test(`Astro build fails for ${setting}=${String(value)}`, async () => {
    const environment = {
      ...process.env,
      SITE_ORIGIN: "https://example.com",
    };
    environment[setting] = value;
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
