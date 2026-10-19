import fs from "node:fs/promises";
import path from "node:path";

import { expect } from "@playwright/test";

import { ownBrowserCleanup } from "../../packages/viewer/tests/browser_cleanup.js";
import { repositoryRoot } from "../helpers/fixture.js";
import { serveStaticFiles } from "../helpers/static_server.js";

import { deliveryRequests } from "./comparison_delivery_assertions.js";
import {
  comparisonPaths,
  copiedComparisonDirectory,
  test,
} from "./comparison_test.js";

test("malformed copied review metadata never falls back to a live comparison endpoint", async ({
  page,
}) => {
  const root = await fs.mkdtemp(
    path.join(
      process.env["MOKLY_VERIFICATION_RESOURCE_ROOT"] ??
        path.join(repositoryRoot, ".context"),
      "malformed-comparison-",
    ),
  );
  let host: Awaited<ReturnType<typeof serveStaticFiles>> | undefined;
  let closing: Promise<void> | undefined;
  const close = () =>
    (closing ??= (async () => {
      await host?.close();
      await fs.rm(root, { recursive: true, force: true });
    })());
  ownBrowserCleanup(close);
  try {
    await fs.cp(copiedComparisonDirectory(), root, { recursive: true });
    const index = JSON.parse(
      await fs.readFile(path.join(root, "mokly-viewer/index.json"), "utf8"),
    );
    const review = path.join(root, index.comparisonUrl);
    await fs.writeFile(review, '{"schemaVersion":8,"entries":"malformed"}');
    host = await serveStaticFiles(root);
    const traffic = deliveryRequests(page);
    await page.goto(`${host.url}/view/${comparisonPaths.changed}/`);
    await page.getByRole("button", { name: "Overlay", exact: true }).click();
    await expect(page.getByRole("button", { name: "Try again" })).toBeVisible();
    await expect(
      page.locator("iframe[data-mokly-comparison-frame]"),
    ).toHaveCount(0);
    expect(traffic.urls.filter((url) => url.includes("/diffs/"))).toEqual([
      new URL(index.comparisonUrl, host.url).href,
    ]);
    traffic.assert();
  } finally {
    await close();
  }
});
