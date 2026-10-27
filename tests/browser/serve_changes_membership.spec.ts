import { expect } from "@playwright/test";

import { test } from "./browser_test.js";
import { serveChanges } from "./serve_changes_fixture.js";

test("native Changes publishes moved and removed entries with matching counts", async ({
  page,
}) => {
  const fixture = await serveChanges();
  try {
    const index = await fixture.index();
    expect(index.changesStatus).toBe("ready");
    expect(
      index.screens.find((entry) => entry.path === "moved")?.previousPath,
    ).toBe("old");
    expect(index.removedEntries.map((entry) => entry.entry.path)).toEqual([
      "retired",
      "removed",
    ]);
    const requests: string[] = [];
    page.on("request", (request) => requests.push(request.url()));
    await page.goto(`${fixture.url}/view/sample/`);
    await expect(page.locator('[data-changes-status="ready"]')).toBeVisible();
    await expect(page.locator('[data-filter="changed"]')).toContainText("4");
    expect(requests.filter((url) => url.includes("/diffs/"))).toEqual([]);
    await page.locator('[data-filter="changed"]').click();
    await expect(
      page.locator('[data-nav-row][data-route="stable/index.html"]'),
    ).toBeHidden();
    await expect(
      page.locator('[data-nav-row][data-route="moved/index.html"]'),
    ).toContainText("Moved");
    await page
      .getByRole("link", { name: "Removed screen · Removed", exact: true })
      .click();
    await expect(
      page
        .frameLocator("iframe[data-mokly-preview-source]")
        .first()
        .getByRole("heading", { name: "Historical screen" }),
    ).toBeVisible();
    await page
      .getByRole("link", { name: "Retired page · Removed", exact: true })
      .click();
    await expect(
      page
        .frameLocator("iframe[data-mokly-preview-source]")
        .getByRole("heading", { name: "Historical page" }),
    ).toBeVisible();
    const detail = await (
      await page.request.get(
        `${fixture.url}/${index.comparisonUrl!}entries/retired.json`,
      )
    ).json();
    expect(detail.revision).toBeUndefined();
    expect(detail.entry.snapshotId).toBe(
      index.removedEntries.find((entry) => entry.entry.path === "retired")!
        .snapshotId,
    );
    expect(
      requests.filter(
        (url) => new URL(url).pathname === "/mokly-viewer/diffs/selection",
      ),
    ).toEqual([]);
  } finally {
    await fixture.close();
  }
});
