import { expect, type Page } from "@playwright/test";

import { test as baseTest } from "./browser_test.js";
import { designDocumentFixture } from "./component_design_fixture.js";
import { documentFavicon } from "./document_error_allowance.js";
import { copiedDesignFileUrl } from "./static_test.js";

/** The Props section of a Canvas artboard's Inspect panel. */
function propsSection(page: Page) {
  return page.locator('[data-cv-section="props"]');
}

/** The Action that one frame of the Action's variant set draws. */
function frameAction(page: Page, frame: string) {
  return page.locator(`.cv-frame[data-cv-frame="${frame}"] .mbk-shot-action`);
}

/** The link to a saved variant in Inspect's Variants section. */
function variantLink(page: Page, name: string) {
  return page
    .getByRole("region", { name: "Variants", exact: true })
    .getByRole("link", { name, exact: true });
}

/** Run the same assertions against each catalogue delivery. */
export function registerComponentControls(
  test = baseTest,
  mode: "serve" | "static" = "serve",
) {
  test.beforeEach(({ allowBrowserError, baseURL }) => {
    documentFavicon(allowBrowserError, baseURL!);
  });
  const { designDocumentUrl } = designDocumentFixture(
    test,
    mode === "static" ? copiedDesignFileUrl : undefined,
  );

  for (const viewport of ["desktop", "mobile"] as const) {
    test(`${viewport}: component controls show saved, edited, reset, and error states`, async ({
      page,
    }) => {
      await page.setViewportSize(
        viewport === "desktop"
          ? { width: 1440, height: 1000 }
          : { width: 390, height: 844 },
      );
      const props = propsSection(page);
      const label = props.getByRole("textbox", { name: "Label", exact: true });
      const disabled = props.getByRole("checkbox", {
        name: "Disabled",
        exact: true,
      });
      await page.goto(
        designDocumentUrl(
          "design/canvas/stage/component-set/disabled",
          viewport,
        ),
      );
      // The chosen variant edits the Disabled variant's props in place.
      await expect(disabled).toBeChecked();
      await expect(frameAction(page, "disabled-light")).toHaveClass(
        /mbk-shot-action--disabled/u,
      );
      await page.goto(
        designDocumentUrl("design/canvas/props/editing", viewport),
      );
      await expect(label).toHaveValue("Continue");
      await expect(
        props.getByRole("spinbutton", { name: "Corner radius", exact: true }),
      ).toHaveValue("8");
      await expect(
        props.getByRole("combobox", { name: "Emphasis", exact: true }),
      ).toHaveValue("primary");
      await expect(disabled).not.toBeChecked();
      await expect(
        props.getByRole("checkbox", { name: "Set Hint", exact: true }),
      ).toBeChecked();
      await label.fill("Next");
      await expect(label).toHaveValue("Next");
      await page.goto(
        designDocumentUrl("design/canvas/props/editing/edited", viewport),
      );
      await expect(frameAction(page, "default-light")).toHaveText(
        "Get started",
      );
      await expect(label).toHaveValue("Get started");
      await props
        .getByRole("link", { name: "Reset to Default", exact: true })
        .click();
      await expect(page).toHaveURL(
        designDocumentUrl("design/canvas/props/editing/reset", viewport),
      );
      await expect(frameAction(page, "default-light")).toHaveText("Continue");
      await expect(label).toHaveValue("Continue");
      await variantLink(page, "Disabled").click();
      await expect(page).toHaveURL(
        designDocumentUrl(
          "design/canvas/stage/component-set/disabled",
          viewport,
        ),
      );
      await expect(frameAction(page, "disabled-light")).toHaveClass(
        /mbk-shot-action--disabled/u,
      );
      await expect(disabled).toBeChecked();
      await page.goto(
        designDocumentUrl("design/canvas/props/states/invalid", viewport),
      );
      const radius = props.getByRole("spinbutton", {
        name: "Corner radius",
        exact: true,
      });
      await expect(radius).toHaveAttribute("aria-invalid", "true");
      await expect(radius).toHaveAccessibleDescription(
        "Enter a number from 0 to 32.",
      );
      // The frames keep the last valid preview.
      await expect(frameAction(page, "default-light")).toHaveCSS(
        "border-radius",
        "8px",
      );
      await page.goto(
        designDocumentUrl("design/canvas/props/states/error", viewport),
      );
      await expect(page.getByRole("alert")).toContainText(
        "The preview could not be updated",
      );
      await props.getByRole("link", { name: "Try again", exact: true }).click();
      await expect(page).toHaveURL(
        designDocumentUrl("design/canvas/props/states", viewport),
      );
      await expect(
        page
          .locator('.cv-frame[data-cv-frame="default-light"]')
          .getByRole("status"),
      ).toContainText("Updating preview");
    });

    test(`${viewport}: unset, comparison, and published views preserve control boundaries`, async ({
      page,
    }) => {
      await page.setViewportSize(
        viewport === "desktop"
          ? { width: 1440, height: 1000 }
          : { width: 390, height: 844 },
      );
      const props = propsSection(page);
      // The optional Hint's field: its Set switch, its input, and Not set.
      const hint = props
        .locator(".mbk-control-field")
        .filter({ hasText: "Set Hint" });
      const set = hint.getByRole("checkbox", { name: "Set Hint", exact: true });
      const input = hint.getByRole("textbox", { name: "Hint", exact: true });
      const notSet = hint.getByText("Not set", { exact: true });
      await page.goto(
        designDocumentUrl("design/canvas/props/editing/unset", viewport),
      );
      await expect(set).not.toBeChecked();
      await expect(input).toBeHidden();
      await expect(notSet).toBeVisible();
      await set.check();
      await expect(input).toBeVisible();
      await expect(notSet).toBeHidden();
      // A field that starts supplied says Not set once the reader clears Set.
      await page.goto(
        designDocumentUrl("design/canvas/props/editing", viewport),
      );
      await expect(notSet).toBeHidden();
      await set.uncheck();
      await expect(input).toBeHidden();
      await expect(notSet).toBeVisible();
      // While Overlay stays chosen in Changes, Inspect shows the current
      // frames, so Props edits Default from its saved props (decision 19 = A).
      await page.goto(
        designDocumentUrl("design/canvas/components/compare/props", viewport),
      );
      const label = props.getByRole("textbox", { name: "Label", exact: true });
      await expect(label).toBeEditable();
      await expect(label).toHaveValue("Continue");
      await expect(props).not.toContainText(
        "Comparisons show the saved props.",
      );
      await expect(
        props.getByRole("link", { name: "Switch to Current", exact: true }),
      ).toHaveCount(0);
      await page.goto(
        designDocumentUrl("design/canvas/props/read-only", viewport),
      );
      await expect(props).toContainText(
        "Open this catalogue locally to edit props.",
      );
      await expect(props.locator("input, select")).toHaveCount(0);
      await variantLink(page, "Disabled").click();
      await expect(page).toHaveURL(
        designDocumentUrl("design/canvas/props/read-only/disabled", viewport),
      );
      await expect(props.locator("input, select")).toHaveCount(0);
      await expect(frameAction(page, "disabled-light")).toHaveClass(
        /mbk-shot-action--disabled/u,
      );
    });
  }
}
