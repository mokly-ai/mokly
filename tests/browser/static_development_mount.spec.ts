/**
 * Development React mounts the copied branch output's removed and moved
 * routes without a render warning. The client mount replaced hydration, so
 * a clean development mount is the check.
 */

import { expect } from "@playwright/test";

import { readCatalogueIndex } from "../../packages/viewer/src/catalogue/index_reader.js";
import { comparisonPaths } from "../helpers/comparison_catalogue.js";
import { movedFixturePaths } from "../helpers/moved_fixture_sources.js";

import { test } from "./branch_point_test.js";
import {
  developmentShell,
  installDevelopmentShell,
} from "./development_shell.js";
import { passRenderingUpdates } from "./page_settling.js";

test("development React mounts removed and moved finalized routes", async ({
  page,
  request,
  branchCopy,
}) => {
  const loads = await installDevelopmentShell(page, await developmentShell());
  const removed = await page.goto(`/view/${comparisonPaths.removedPage}/`);
  expect(removed?.status()).toBe(200);
  await expect(page.locator(".mbk-previous")).toHaveText(
    "Showing previous version",
  );
  await expect(
    page.frameLocator("[data-mokly-preview] iframe").locator("h1"),
  ).toHaveText("Historical page");
  await passRenderingUpdates(page);
  expect(loads()).toBe(1);

  const moved = movedFixturePaths.movedPage;
  const current = await page.goto(`/view/${moved}/`);
  expect(current?.status()).toBe(200);
  await expect(page.locator(".mbk-screen-head h2")).toHaveText("Payment guide");
  await expect(page.locator(".mbk-previous")).toHaveCount(0);
  await passRenderingUpdates(page);
  expect(loads()).toBe(2);

  const index = readCatalogueIndex(
    await (
      await request.get(`${branchCopy.url}/mokly-viewer/index.json`)
    ).json(),
  );
  const guide = index.pages.find((entry) => entry.path === moved)!;
  expect(guide.previousPath).toBe("branch/moves/previous/guide");
  expect(guide.changes).toEqual({
    status: "ready",
    kind: "unmodified",
    included: true,
  });
  expect(index.removedEntries.map(({ entry }) => entry.path)).toContain(
    comparisonPaths.removedPage,
  );
  expect(
    (
      await request.get(`${branchCopy.url}/view/branch/moves/previous/guide/`)
    ).status(),
  ).toBe(404);
});
