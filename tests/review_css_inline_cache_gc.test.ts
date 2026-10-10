import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const run = promisify(execFile);
const helper = fileURLToPath(
  new URL("./helpers/css_inline_cache_gc.mjs", import.meta.url),
);

for (const entrypoint of ["list", "analysis"])
  for (const kind of ["valid", "invalid", "fallback", "segment"])
    test(`production ${entrypoint} releases a 48 MiB page for a ${kind} style under the default bound`, async () => {
      const { stdout } = await run(process.execPath, [
        "--expose-gc",
        "--import",
        "tsx",
        helper,
        entrypoint,
        kind,
      ]);
      const probe = JSON.parse(stdout) as {
        allocatedBytes: number;
        releasedBytes: number;
        retainedBytes: number;
      };
      assert.ok(probe.allocatedBytes > 40 * 1024 * 1024, stdout);
      assert.ok(probe.releasedBytes > probe.allocatedBytes * 0.8, stdout);
      assert.ok(probe.retainedBytes < probe.allocatedBytes * 0.2, stdout);
    });
