import path from "node:path";

import { runInherited } from "../process.mjs";

const harness = process.env.MOKLY_PLAYWRIGHT_SCOPE_ROOT;
if (!harness) throw new Error("MOKLY_PLAYWRIGHT_SCOPE_ROOT is required");
const result = await runInherited(
  process.execPath,
  [
    path.resolve(
      import.meta.dirname,
      "../../../node_modules/@playwright/test/cli.js",
    ),
    "test",
    "--config",
    path.join(harness, "playwright.config.mjs"),
  ],
  { cwd: harness, env: process.env },
);
if (result.interrupted || result.signal || result.exitCode !== 0)
  process.exitCode = 1;
