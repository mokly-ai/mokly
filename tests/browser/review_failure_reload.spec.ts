import fs from "node:fs";
import path from "node:path";

import { expect, test } from "@playwright/test";

import { compileCatalogue } from "../../dist/build/compile.js";
import { writeCompilation } from "../../dist/build/transaction.js";
import { loadConfig } from "../../dist/config/load.js";
import { startCatalogueServer } from "../../dist/server/http.js";
import type { RunningServer } from "../../dist/server/http_types.js";
import type { ServedReview } from "../../dist/server/review_routes.js";
import type { ReviewResultV2 } from "../../packages/viewer/dist/review/types.js";
import {
  createFixture,
  removeFixture,
  type TestFixture,
} from "../helpers/fixture.js";

let fixture: TestFixture;
let server: RunningServer;
let shouldFail = true;
let generations = 0;

test.beforeAll(async () => {
  fixture = await createFixture();
  const outDir = path.join(fixture.root, ".review");
  const review: ServedReview = {
    base: "origin/main",
    async generate(): Promise<void> {
      generations += 1;
      if (shouldFail) throw new Error("temporary comparison failure");
      await fs.promises.mkdir(outDir, { recursive: true });
      await fs.promises.writeFile(
        path.join(outDir, "review.json"),
        JSON.stringify({
          schemaVersion: 2,
          baseCommit: "a".repeat(40),
          baseRef: "origin/main",
          changedPaths: [],
          ignoredImpact: [],
          screens: [],
          sharedImpact: [],
        } satisfies ReviewResultV2),
      );
      await fs.promises.writeFile(
        path.join(outDir, ".mokly-review-artifact"),
        "schemaVersion=1\n",
      );
    },
    outDir,
  };
  const config = await loadConfig(fixture.root);
  await writeCompilation(await compileCatalogue(config), config);
  server = await startCatalogueServer(config, {
    base: "origin/main",
    changedRoutes: ["screens/home.html"],
    port: 0,
    review,
  });
});

test.afterAll(async () => {
  await server.close();
  await removeFixture(fixture);
});

test("a watched update resets failed diffs to Current without generating", async ({
  page,
}) => {
  const eventStream = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === "/__mokly/events" &&
      response.status() === 200,
  );
  await page.goto(`${server.url}/view/screens/home.html`);
  await eventStream;
  await page.getByRole("button", { name: "Overlay", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Try again", exact: true }),
  ).toBeVisible();
  expect(generations).toBe(1);
  shouldFail = false;
  server.publishUpdate({ version: 2, changedRoutes: ["screens/home.html"] });
  await expect(page.locator("html")).toHaveAttribute(
    "data-mokly-update-version",
    "2",
  );
  await page.waitForLoadState("load");
  await expect(
    page.getByRole("button", { name: "Current", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  expect(generations).toBe(1);
  await page.getByRole("button", { name: "Overlay", exact: true }).click();
  await expect(page.locator("[data-diff-stage]")).toContainText(
    "This screen has no comparison available.",
  );
  expect(generations).toBe(2);
});
