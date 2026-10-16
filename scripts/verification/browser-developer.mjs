import path from "node:path";

import { browserWorkerCount } from "./concurrency.mjs";
import { requirePrepared } from "./prepared.mjs";
import { runInherited } from "./process.mjs";

const repository = path.resolve(import.meta.dirname, "../..");
const workers = browserWorkerCount();
await requirePrepared(repository, { browser: true });
console.log(`browser Playwright workers: ${workers}`);
const result = await runInherited(
  process.execPath,
  [
    path.join(repository, "node_modules/@playwright/test/cli.js"),
    "test",
    ...process.argv.slice(2),
  ],
  { cwd: repository },
);
if (result.exitCode !== 0 || result.signal || result.interrupted)
  process.exitCode = 1;
