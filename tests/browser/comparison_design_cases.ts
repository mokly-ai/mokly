import path from "node:path";

import { expect } from "@playwright/test";

import { repositoryRoot } from "../helpers/fixture.js";

import { test as baseTest } from "./browser_test.js";
import { designFileUrl as servedDesignFileUrl } from "./design_fixture.js";
import { expectReasonSentences } from "./design_reason_sentences.js";
import { documentFavicon } from "./document_error_allowance.js";
import { copiedDesignFileUrl } from "./static_test.js";

/** Run the same assertions against each catalogue delivery. */
export function registerComparisonDesign(
  test = baseTest,
  mode: "serve" | "static" = "serve",
) {
  test.beforeEach(({ allowBrowserError, baseURL }) => {
    documentFavicon(allowBrowserError, baseURL!);
  });
  const designFileUrl =
    mode === "static" ? copiedDesignFileUrl : servedDesignFileUrl;
  const design = (entryPath: string, viewport: string): string =>
    designFileUrl(
      path.join(
        repositoryRoot,
        "examples/basic/mokly-generated",
        entryPath,
        `index.${viewport}.html`,
      ),
    ).href;

  test("Current on the Changes tab offers changed Welcome's comparison modes in both artboards", async ({
    page,
  }) => {
    for (const viewport of ["mobile", "desktop"] as const) {
      await page.goto(design("design/canvas/changes/current", viewport));
      await expect(
        page.locator(
          '.cv-canvas .mbk-entry-status[data-status="Changed"]:visible',
        ),
      ).toHaveText("Changed");
      const modes = page.getByRole("list", { name: "Comparison mode" });
      await expect(modes).toBeVisible();
      await expect(
        modes.getByRole("link", { name: "Current", exact: true }),
      ).toHaveAttribute("aria-current", "page");
      await expect(modes).toContainText("Side by side");
      await expect(modes).toContainText("Overlay");
      await expect(modes).toContainText("Difference");
    }
    // The desktop artboard keeps the catalogue open at Welcome's changed row.
    await expect(
      page.locator(
        '.mbk-nav-row[aria-current="page"][data-changed="true"] .mbk-nav-changed-text',
      ),
    ).toHaveText("Changed");
  });

  test("flow designs keep comparisons on the owning screens", async ({
    page,
  }) => {
    for (const viewport of ["desktop", "mobile"]) {
      await page.goto(design("design/browse/views/use-case", viewport));
      await expect(
        page.getByRole("group", { name: "Comparison mode" }),
      ).toHaveCount(0);
      await expect(page.locator(".flow-step-link")).toHaveCount(2);
    }
  });

  test("a removed screen's design shows its previous version without comparisons", async ({
    page,
  }) => {
    for (const viewport of ["desktop", "mobile"]) {
      await page.goto(design("design/changes/outcomes/removed", viewport));
      await expect(
        page.getByText("Comparison details", { exact: true }),
      ).toBeVisible();
      await expect(page.locator(".mbk-entry-status")).toHaveText("Removed");
      await expect(
        page.getByText("Farewell was removed from the catalogue.", {
          exact: true,
        }),
      ).toBeVisible();
      await expectReasonSentences(
        page.locator(".mbk-comparison-details"),
        ["removed"],
        `${viewport} outcomes/removed`,
      );
      await expect(
        page.getByRole("group", { name: "Comparison mode" }),
      ).toHaveCount(0);
      await expect(page.locator(".mbk-previous")).toHaveText(
        "Showing previous version",
      );
      await expect(page.locator(".mbk-empty")).toHaveCount(0);
      const frame = page
        .locator(viewport === "desktop" ? ".browser-frame" : ".phone-frame")
        .first();
      await expect(frame).toBeVisible();
      await expect(frame).toContainText("Thanks for looking around");
    }
  });

  test("a viewport with no previous view names the one that still opens", async ({
    page,
  }) => {
    for (const viewport of ["desktop", "mobile"]) {
      await page.goto(
        design("design/changes/outcomes/previous-version/no-view", viewport),
      );
      await expect(page.locator(".mbk-entry-status")).toHaveText("Removed");
      await expect(page.locator(".mbk-previous")).toHaveText(
        "Showing previous version",
      );
      await expect(
        page.getByRole("group", { name: "Comparison mode" }),
      ).toHaveCount(0);
      const note = page.locator(".mbk-preview-note");
      const hint = page.locator(".mbk-preview-switch");
      const captured = page.locator(".ce-preview-view:visible .browser-frame");
      const selection = page.getByRole("combobox", {
        name: "Viewport",
      });
      await expect(selection).toHaveValue("mobile");
      await expect(note).toBeVisible();
      await expect(note).toHaveText(
        "No previous mobile version was captured. Switch to Desktop to see it.",
      );
      await expect(captured).toHaveCount(0);
      await selection.selectOption("both");
      await expect(hint).toBeHidden();
      await expect(note).toBeVisible();
      await expect(captured).toBeVisible();
      await selection.selectOption("desktop");
      await expect(note).toBeHidden();
      await expect(captured).toBeVisible();
    }
  });

  test("empty Changes designs retain the selected current screen", async ({
    page,
  }) => {
    for (const viewport of ["desktop", "mobile"]) {
      await page.goto(design("design/canvas/loading/changes/empty", viewport));
      await expect(page.locator(".cv-canvas .cv-title-tag:visible")).toHaveText(
        "Welcome",
      );
      await expect(
        page.getByRole("list", { name: "Comparison mode" }),
      ).toHaveCount(0);
      await expect(page.locator(".mbk-nav-filter-count")).toHaveText("0");
    }
  });
}
