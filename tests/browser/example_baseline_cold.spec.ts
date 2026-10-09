import fs from "node:fs/promises";
import path from "node:path";

import { expect, test } from "@playwright/test";

import { exportCatalogue } from "../../dist/export/run.js";
import {
  prepareIndependentExample,
  validateWarmExample,
} from "../helpers/example_preparation.js";
import {
  FULL_CATALOGUE_SETUP_TIMEOUT_MS,
  timeExportPreparation,
} from "../helpers/fixture_timing.js";
import { serveStaticFiles } from "../helpers/static_server.js";

test("a real cold example baseline installs and builds v10 before comparison", async ({
  page,
}) => {
  test.setTimeout(FULL_CATALOGUE_SETUP_TIMEOUT_MS);
  const prepared = await prepareIndependentExample(
    "cold-example-baseline",
    true,
  );
  let server: Awaited<ReturnType<typeof serveStaticFiles>> | undefined;
  try {
    expect(prepared.config.review.baselineBuild).toEqual([
      ["npm", "ci"],
      ["npm", "run", "build"],
      ["npm", "run", "example:build"],
    ]);
    await validateWarmExample(prepared.config, prepared.commit);
    const output = path.join(prepared.root, "site");
    const result = await timeExportPreparation(
      "cold-example-baseline",
      () =>
        exportCatalogue(prepared.config, {
          base: "HEAD",
          outDir: output,
          signal: prepared.signal,
        }),
      { operationUnderTest: true, expectWarmBaseline: true },
    );
    expect(result.comparisonUrl).toBeTruthy();
    const comparison = JSON.parse(
      await fs.readFile(
        path.join(output, result.comparisonUrl!.slice(1)),
        "utf8",
      ),
    );
    expect(comparison.schemaVersion).toBe(7);
    expect(comparison.baseCommit).toBe(prepared.commit);
    server = await serveStaticFiles(output);
    await page.goto(`${server.url}/view/example/screens/welcome/`);
    await expect(page.locator("#mb-main h2")).toHaveText("Welcome");
    await expect(page.locator("[data-workspace-status]")).toHaveText(
      "Unmodified",
    );
  } finally {
    await server?.close();
    await prepared.close();
  }
});
