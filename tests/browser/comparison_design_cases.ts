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
    const modes = page.getByRole("list", { name: "Comparison mode" });
    // Each step frame's title is the link that opens the step's screen.
    const steps = page.locator(".cv-frames").getByRole("link");
    // A desktop shows every step, in step order, and no compare mode.
    await page.goto(design("design/canvas/flows/tour", "desktop"));
    await expect(steps).toHaveText(["Welcome", "Details"]);
    await expect(modes).toHaveCount(0);
    // A phone shows the step that its frame picker picks.
    await page.goto(design("design/canvas/flows/tour", "mobile"));
    await expect(steps).toHaveText(["Welcome"]);
    await expect(modes).toHaveCount(0);
    await page
      .getByRole("combobox", { name: "Frame" })
      .selectOption({ label: "2 · Details" });
    await expect(steps).toHaveText(["Details"]);
    // The branch changed both step screens, so Changes lists the use case
    // as Changed. Its Changes tab keeps the step frames, offers no compare
    // mode, and names each changed step in the comparison details.
    for (const viewport of ["mobile", "desktop"] as const) {
      await page.goto(design("design/canvas/flows/tour/changes", viewport));
      await expect(
        page.locator(".cv-canvas .mbk-entry-status:visible"),
      ).toHaveText("Changed");
      await expect(page.locator(".cv-stepper-count")).toHaveText(
        "Change 3 of 11",
      );
      await expect(modes).toHaveCount(0);
      await expect(
        page.locator(".cv-evidence .mbk-comparison-evidence > p"),
      ).toHaveText(["Changed step: Welcome", "Changed step: Details"]);
    }
    // The desktop catalogue counts eleven changes and selects the tour's
    // changed row, and the canvas keeps both steps.
    await expect(page.locator(".mbk-nav-filter-count")).toHaveText("11");
    await expect(
      page.locator('.mbk-nav-row[aria-current="page"][data-changed="true"]'),
    ).toContainText("Example tour");
    await expect(steps).toHaveText(["Welcome", "Details"]);
    // A changed step's title opens that step's screen on its Changes tab.
    await page
      .locator(".cv-evidence")
      .getByRole("link", { name: "Details", exact: true })
      .click();
    await expect(page).toHaveURL(
      design("design/canvas/outcomes/added/changes", "desktop"),
    );
  });

  test("a removed screen's design shows its previous version without comparisons", async ({
    page,
  }) => {
    const removed = "design/canvas/outcomes/removed";
    for (const viewport of ["desktop", "mobile"]) {
      await page.goto(design(removed, viewport));
      // The section head, or a phone's entry bar, names the Removed status
      // and the previous version that the frames show.
      await expect(
        page.locator(".cv-canvas .mbk-entry-status:visible"),
      ).toHaveText("Removed");
      await expect(page.locator(".cv-previous-label:visible")).toHaveText(
        "Showing previous version",
      );
      await expect(
        page.getByRole("list", { name: "Comparison mode" }),
      ).toHaveCount(0);
      await expect(page.locator(".mbk-empty")).toHaveCount(0);
      const frame = page.locator('.cv-frame[data-cv-frame="mobile-light"]');
      await expect(frame).toBeVisible();
      await expect(frame).toContainText("Thanks for looking around");
    }
    // The Changes tab keeps the comparison details and their reason, and
    // Inspect keeps the description of the branch point's record.
    await page.goto(design(removed, "desktop"));
    const details = page.locator(".cv-evidence .mbk-comparison-evidence");
    await expect(details).toContainText("Comparison details");
    await expectReasonSentences(details, ["removed"], `desktop ${removed}`);
    await page
      .getByRole("region", { name: "Panel", exact: true })
      .getByRole("link", { name: "Inspect", exact: true })
      .click();
    await expect(page).toHaveURL(design(`${removed}/inspect`, "desktop"));
    await expect(
      page.getByText(
        "A closing screen that thanks the reader for looking around.",
        { exact: true },
      ),
    ).toBeVisible();
  });

  test("a viewport with no previous view names the one that still opens", async ({
    page,
  }) => {
    const noView = "design/canvas/outcomes/removed/no-view";
    // The note stands in the place of the mobile frame, whose view was never
    // captured; its second sentence names the desktop frame.
    const note = page.locator(
      '.cv-frame[data-cv-frame="mobile-light"] .mbk-preview-note',
    );
    const hint = note.locator(".mbk-preview-switch");
    const captured = page.locator('.cv-frame[data-cv-frame="desktop-light"]');
    await page.goto(design(noView, "desktop"));
    await expect(
      page.locator(".cv-canvas .mbk-entry-status:visible"),
    ).toHaveText("Removed");
    await expect(page.locator(".cv-previous-label:visible")).toHaveText(
      "Showing previous version",
    );
    await expect(
      page.getByRole("list", { name: "Comparison mode" }),
    ).toHaveCount(0);
    await expect(note).toBeVisible();
    await expect(note).toHaveText(
      "No previous mobile version was captured. Switch to Desktop to see it.",
    );
    // The desktop frame shows beside the note, so the sentence that names
    // it is hidden, until the Frames filter hides that frame.
    await expect(captured).toBeVisible();
    await expect(hint).toBeHidden();
    await page
      .getByRole("group", { name: "Frames", exact: true })
      .getByRole("checkbox", { name: /^Desktop/u })
      .uncheck();
    await expect(captured).toBeHidden();
    await expect(hint).toBeVisible();
    // A phone shows one frame, so the note says where the view opens, and
    // the frame picker opens it.
    await page.goto(design(noView, "mobile"));
    await expect(note).toBeVisible();
    await expect(hint).toBeVisible();
    await expect(captured).toBeHidden();
    await page
      .getByRole("combobox", { name: "Frame" })
      .selectOption("desktop-light");
    await expect(captured).toBeVisible();
    await expect(note).toBeHidden();
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
