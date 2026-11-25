import path from "node:path";

import { selectionNeedsCopiedHost } from "./browser-developer-selection.mjs";
import { copiedHostSpecs } from "./browser-host-needs.mjs";
import { browserWorkerCount } from "./concurrency.mjs";
import { discoverBrowserTests } from "./playwright.mjs";
import { requirePrepared } from "./prepared.mjs";
import { runInherited } from "./process.mjs";

const repository = path.resolve(import.meta.dirname, "../..");
const args = process.argv.slice(2);
const workers = browserWorkerCount();
await requirePrepared(repository, { browser: true });
console.log(`browser Playwright workers: ${workers}`);
const environment = { ...process.env };
// The runner alone decides whether global setup builds the copied example.
delete environment.MOKLY_PLAYWRIGHT_COPIED_HOST;
const copiedHost = await selectionNeedsCopiedHost(args, {
  list: async (filters) =>
    (await discoverBrowserTests(repository, { filters })).files,
  readers: (files) => copiedHostSpecs(repository, files),
});
if (!copiedHost) {
  environment.MOKLY_PLAYWRIGHT_COPIED_HOST = "skip";
  console.log("browser copied example: skipped, no selected spec reads it");
}
const result = await runInherited(
  process.execPath,
  [
    path.join(repository, "node_modules/@playwright/test/cli.js"),
    "test",
    ...args,
  ],
  { cwd: repository, env: environment },
);
if (result.exitCode !== 0 || result.signal || result.interrupted)
  process.exitCode = 1;
