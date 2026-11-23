import { expect, type Page } from "@playwright/test";

import { test } from "./browser_test.js";
import {
  DOCUMENT_FRAME,
  expectFrameSource,
  revealInPanel,
} from "./workspace_actions.js";

/** One labelled row of Inspect's Details. */
function metaRow(page: Page, label: string) {
  return page.locator('[data-inspect-section="details"] .mbk-meta-row', {
    has: page.locator(".mbk-meta-k", { hasText: label }),
  });
}

for (const width of [390, 1280])
  test(`${width}px: a document page keeps its title, location, and path in both schemes, and shows its Details`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/view/example/workspace-guide/");
    const head = page.locator('#mb-main [data-inspect-section="details"]');
    // Inspect's head and its Details rows stand in the right panel, which the
    // compact layout opens as a sheet.
    await revealInPanel(page, head);
    const frame = page.locator(DOCUMENT_FRAME);
    const fallback = page.locator(".mbk-scheme-fallback");
    for (const scheme of ["light", "dark"] as const) {
      await page.getByLabel("Appearance", { exact: true }).selectOption(scheme);
      await expect(head.locator("h2")).toHaveText("Workspace guide");
      const path = head.locator("[data-inspect-path]");
      await expect(path.locator("code")).toHaveText("example/workspace-guide");
      await expect(
        path.getByRole("link", { name: "example", exact: true }),
      ).toHaveAttribute("href", "/view/example/");
      // The standalone Appearance sets the document's scheme, so the head
      // has no preview control of its own.
      await expect(head.locator("[data-workspace-scheme]")).toHaveCount(0);
      await expect(frame).toHaveAttribute("data-mokly-frame-state", "ready");
      await expectFrameSource(
        frame,
        scheme === "dark" ? /index\.dark\.html$/u : /index\.html$/u,
      );
      await expect(fallback).toHaveCount(0);
      const image = page.frameLocator(DOCUMENT_FRAME).locator("img");
      await expect(image).toBeVisible();
      await expect
        .poll(() =>
          image.evaluate(
            (element: HTMLImageElement) =>
              element.complete && element.naturalWidth > 0,
          ),
        )
        .toBe(true);
    }

    // The head shows the description and the Details rows at once.
    await expect(head.locator(".mbk-inspect-description")).toHaveText(
      "Find your way around the workspace.",
    );
    await expect(metaRow(page, "Source")).toContainText(
      "examples/basic/specs/example/workspace-guide.md",
    );
    await expect(
      metaRow(page, "Tags").locator('[data-mokly-tag="guide"]'),
    ).toHaveCount(1);
    await expect(metaRow(page, "Dependencies")).toHaveCount(0);
    await expect(metaRow(page, "Schemes")).toHaveCount(0);
  });
