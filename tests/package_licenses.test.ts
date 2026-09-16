import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { promisify } from "node:util";

const inspector = new URL("../scripts/package/archive.mjs", import.meta.url)
  .href;

test("runtime license inspection resolves workspace links without exempting targets", async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), "mokly-licenses-"));
  t.after(() => rm(root, { force: true, recursive: true }));
  const run = () =>
    promisify(execFile)(process.execPath, [
      "--input-type=module",
      "-e",
      `import { inspectRuntimeLicenses } from ${JSON.stringify(inspector)}; await inspectRuntimeLicenses(process.argv[1]);`,
      root,
    ]);
  for (const license of ["MIT", "UNLICENSED", undefined]) {
    await writeFile(
      path.join(root, "package-lock.json"),
      JSON.stringify({
        packages: {
          "": { license: "MIT" },
          "node_modules/@mokly/site": { link: true, resolved: "site" },
          site: { license },
        },
      }),
    );
    if (license === "MIT") await run();
    else
      await assert.rejects(
        run(),
        /runtime dependency licenses must be declared/,
      );
  }
});
