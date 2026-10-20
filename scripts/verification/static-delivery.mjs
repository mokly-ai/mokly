import fs from "node:fs/promises";
import path from "node:path";

import { readReport, verificationIdentity, writeReport } from "./evidence.mjs";
import { requirePrepared } from "./prepared.mjs";
import { runInherited } from "./process.mjs";
import { checkDeliveryMode } from "./static-delivery-mode.mjs";

const root = path.resolve(import.meta.dirname, "../..");
await requirePrepared(root, { browser: true });
const reports = path.join(root, ".context/static-delivery");
await fs.mkdir(reports, { recursive: true });
for (const mode of ["static-http", "file"])
  await fs.rm(path.join(reports, `${mode}.json`), { force: true });
await writeReport(
  path.join(reports, "identity.json"),
  await verificationIdentity(root),
);
const temporary = await fs.mkdtemp(path.join(reports, "example-"));
const directory = path.join(temporary, "site");
let drained = true;
try {
  await run([
    "packages/mokly/bin/mokly.mjs",
    "build",
    "--config",
    "examples/basic/mokly.config.json",
    "--strict",
    "--no-changes",
    "--out",
    directory,
  ]);
  for (const mode of ["static-http", "file"]) {
    const env = { ...process.env };
    delete env.MOKLY_PLAYWRIGHT_STATIC_DIR;
    delete env.MOKLY_PLAYWRIGHT_FILE_DIR;
    env[
      mode === "file"
        ? "MOKLY_PLAYWRIGHT_FILE_DIR"
        : "MOKLY_PLAYWRIGHT_STATIC_DIR"
    ] = directory;
    env.MOKLY_DELIVERY_REPORT = path.join(reports, `${mode}.json`);
    await fs.rm(env.MOKLY_DELIVERY_REPORT, { force: true });
    console.log(`Static delivery: ${mode}`);
    await checkDeliveryMode(
      () =>
        run(
          [
            "node_modules/@playwright/test/cli.js",
            "test",
            "--config=playwright.delivery.config.ts",
          ],
          env,
        ),
      () => readReport(env.MOKLY_DELIVERY_REPORT),
    );
  }
} finally {
  if (drained) await fs.rm(temporary, { recursive: true, force: true });
}

/** @param {string[]} args @param {NodeJS.ProcessEnv} env */
async function run(args, env = process.env) {
  drained = false;
  const result = await runInherited(process.execPath, args, { cwd: root, env });
  drained = true;
  if (result.exitCode !== 0 || result.signal || result.interrupted)
    throw new Error(
      `Static delivery failed: ${result.signal ?? result.interrupted ?? result.exitCode}`,
    );
}
