import { expect } from "@playwright/test";

import { comparisonPaths, test } from "./comparison_test.js";
import { staticRequests } from "./static_delivery_assertions.js";
import { chooseScheme } from "./workspace_actions.js";

const removed = [
  [
    comparisonPaths.removedScreen,
    "Retired screen",
    "Historical screen",
    "screen",
  ],
  [comparisonPaths.removedPage, "Retired page", "Historical page", "page"],
  [
    comparisonPaths.removedDocument,
    "Retired document",
    "Historical document",
    "document",
  ],
  [
    comparisonPaths.removedComponent,
    "Retired component",
    "Historical component",
    "component",
  ],
  [comparisonPaths.removedVariant, "Card", "Card content", "component"],
] as const;

for (const viewport of ["mobile", "desktop"] as const) {
  for (const scheme of ["light", "dark"] as const) {
    for (const [entryPath, title, content, kind] of removed) {
      test(`${viewport}/${scheme}: copied history retains ${entryPath} without a current document`, async ({
        page,
        request,
        baseURL,
      }) => {
        const index = await (
          await request.get(`${baseURL}/mokly-viewer/index.json`)
        ).json();
        const record = index.removedEntries.find(
          (item: { entry: { path: string } }) => item.entry.path === entryPath,
        );
        expect(record).toBeDefined();
        expect(record.entry.kind).toBe(kind);
        const requests = staticRequests(page);
        await page.goto(
          `/view/${entryPath}/?snapshot=${record.snapshotId}&viewport=${viewport}`,
        );
        await expect(page.locator("#mb-main h2").first()).toHaveText(title);
        await chooseScheme(page, scheme);
        const comparison = kind === "component";
        if (comparison) {
          // A removed variant names itself; its parent Card survives.
          const subject =
            entryPath === comparisonPaths.removedVariant
              ? "variant"
              : "component";
          await expect(
            page.getByRole("heading", {
              name: `This ${subject} was removed`,
              exact: true,
            }),
          ).toBeVisible();
          await page
            .getByRole("button", { name: "Side by side", exact: true })
            .click();
          await expect(page.locator(".mb-pane--after iframe")).toHaveCount(0);
          await expect(
            page.locator(".mb-pane--after .mb-pane-missing"),
          ).toBeVisible();
        } else {
          await expect(
            page.getByText("Showing previous version", { exact: true }),
          ).toBeVisible();
        }
        const frame = page.locator(
          comparison
            ? "iframe[data-mokly-comparison-frame]"
            : "iframe[data-mokly-preview-frame]",
        );
        await expect(frame).toHaveCount(1);
        const file =
          kind === "page"
            ? "index.html"
            : kind === "document"
              ? `index${scheme === "dark" ? ".dark" : ""}.html`
              : `index.${viewport}${scheme === "dark" ? ".dark" : ""}.html`;
        const generation = new URL(index.comparisonUrl, baseURL).href;
        await expect(frame).toHaveAttribute(
          "data-mokly-preview-source",
          `${generation}snapshots/before/mokly-generated/${entryPath}/${file}`,
        );
        await expect(frame).toHaveAttribute("sandbox", "allow-same-origin");
        await expect(frame).not.toHaveAttribute("src");
        await expect(frame.contentFrame().locator("body")).toContainText(
          content,
        );
        await expect(page.locator("iframe[data-workspace-frame]")).toHaveCount(
          0,
        );
        const currentPath = `/static/mokly-generated/${entryPath}/${file}`;
        expect((await request.get(`${baseURL}${currentPath}`)).status()).toBe(
          404,
        );
        expect(
          requests.urls.filter((url) => new URL(url).pathname === currentPath),
        ).toEqual([]);
        requests.assert();
      });
    }
  }
}
