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
import { missingResourceNotice } from "./document_error_allowance.js";

test("a copied comparison without a pane document never falls back to a live comparison endpoint", async ({
  page,
  allowBrowserError,
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
    // The copy lost the current side of the changed screen's mobile view.
    const document = `${index.comparisonUrl}snapshots/after/mokly-generated/${comparisonPaths.changed}/index.mobile.html`;
    await fs.rm(path.join(root, document));
    host = await serveStaticFiles(root);
    const missing = new URL(document, `${host.url}/`).href;
    allowBrowserError(missingResourceNotice(missing));
    const traffic = deliveryRequests(page, [missing]);
    await page.goto(
      `${host.url}/view/${comparisonPaths.changed}/?viewport=mobile`,
    );
    await page.getByRole("button", { name: "Overlay", exact: true }).click();
    await expect(page.getByRole("button", { name: "Try again" })).toBeVisible();
    await expect(
      page.locator("iframe[data-mokly-comparison-frame]"),
    ).toHaveCount(0);
    // The panes read only the pinned generation's documents.
    const generation = new URL(index.comparisonUrl, `${host.url}/`).href;
    const diffs = traffic.urls.filter((url) => url.includes("/diffs/"));
    expect(diffs).toContain(missing);
    for (const url of diffs)
      expect(url.startsWith(`${generation}snapshots/`)).toBe(true);
    traffic.assert();
  } finally {
    await close();
  }
});
