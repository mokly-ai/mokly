import path from "node:path";

import { browserSelectionArguments } from "./browser-developer-selection.mjs";
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
if (!(await selectionNeedsCopiedHost(args))) {
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

/**
 * A selected run needs the copied example when one of its specs reads it. A
 * run that no list can narrow, or whose list fails, builds the example, and
 * Playwright then reports its own selection errors.
 */
async function selectionNeedsCopiedHost(selected) {
  const filters = browserSelectionArguments(selected);
  if (!filters) return true;
  let inventory;
  try {
    inventory = await discoverBrowserTests(repository, { filters });
  } catch {
    return true;
  }
  return (await copiedHostSpecs(repository, inventory.files)).size > 0;
}
