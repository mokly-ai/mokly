import { expect, test, type Page } from "@playwright/test";

import { expectFrameSource } from "./workspace_actions.js";

/** One labelled metadata row in the open Details panel. */
function metaRow(page: Page, label: string) {
  return page.locator(".mbk-details-body .mbk-meta-row", {
    has: page.locator(".mbk-meta-k", { hasText: label }),
  });
}

for (const width of [390, 1280])
  test(`${width}px: a document page keeps its title, location, and path in both schemes, and shows its Details`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/view/example/workspace-guide/");
    const head = page.locator("#mb-main .mbk-screen-head");
    const frame = page.locator(".mbk-stage-embed iframe");
    const fallback = page.locator(".mbk-scheme-fallback");
    for (const scheme of ["light", "dark"] as const) {
      await page.getByLabel("Appearance", { exact: true }).selectOption(scheme);
      await expect(head.locator("h2")).toHaveText("Workspace guide");
      await expect(
        page
          .getByLabel("Catalogue location")
          .getByRole("link", { name: "Example", exact: true }),
      ).toHaveAttribute("href", "/view/example/");
      await expect(head.locator(".mbk-pathchip")).toHaveText(
        "example/workspace-guide",
      );
      await expect(
        head.locator("[data-mokly-viewswitch], [data-mokly-schemeswitch]"),
      ).toHaveCount(0);
      await expect(frame).toHaveAttribute("data-mokly-frame-state", "ready");
      await expectFrameSource(
        frame,
        scheme === "dark" ? /index\.dark\.html$/u : /index\.html$/u,
      );
      await expect(fallback).toHaveCount(0);
    }

    await page.locator("[data-mokly-details] summary").click();
    await expect(page.locator(".mbk-details-desc")).toHaveText(
      "Find your way around the workspace.",
    );
    await expect(metaRow(page, "Source")).toContainText(
      "examples/basic/specs/example/workspace-guide.md",
    );
    await expect(
      metaRow(page, "Tags").locator('[data-mokly-tag="guide"]'),
    ).toHaveCount(1);
    await expect(metaRow(page, "Dependencies")).toContainText(
      "examples/basic/specs/example/workspace.svg",
    );
    await expect(metaRow(page, "Schemes")).toHaveCount(0);
  });
