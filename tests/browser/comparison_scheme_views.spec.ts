import { expect, type Page } from "@playwright/test";

import { shellRoot } from "./browse_assertions.js";
import { comparisonPaths, test } from "./comparison_test.js";
import { awaitRoutedDetail, modeButton, showMode } from "./comparison_ui.js";
import {
  chooseVariant,
  chooseViewport,
  expectFrameSource,
} from "./workspace_actions.js";

const SCHEME_DOT = '[data-view-changed="scheme"]';
const VIEWPORT_DOT = '[data-view-changed="viewport"]';
const TOOLBAR = ".mbk-diff-toolbar";

/** The mark's painted geometry, so a hidden dot cannot pass as a drawn one. */
function dotStyle(page: Page, selector: string) {
  return page.locator(selector).evaluate((mark) => {
    const style = getComputedStyle(mark);
    return {
      display: style.display,
      radius: style.borderTopLeftRadius,
      shadow: style.boxShadow,
      width: style.width,
    };
  });
}

async function expectShownStatus(
  page: Page,
  path: string,
  status: "Changed" | "Unmodified",
  comparison: boolean,
): Promise<void> {
  await awaitRoutedDetail(page, path);
  await expect(page.locator("[data-workspace-status]")).toHaveText(status);
  if (comparison) await expect(page.locator(TOOLBAR)).toBeVisible();
  else await expect(page.locator(TOOLBAR)).toBeHidden();
}

test("a dark-only change marks the views it hides and opens on one", async ({
  page,
}) => {
  const diffs: string[] = [];
  page.on("request", (request) => {
    if (request.url().includes("/mokly-viewer/diffs/"))
      diffs.push(request.url());
  });
  await page.goto(`/view/${comparisonPaths.darkOnly}/?comparison=side`);
  const scheme = page.getByLabel("Appearance", { exact: true });
  await expect(page.locator(shellRoot)).toHaveAttribute(
    "data-mokly-color-scheme",
    "light",
  );
  await expect(
    page.locator(".mbk-appearance").locator(SCHEME_DOT),
  ).toBeVisible();
  await expect(scheme).toHaveAttribute(
    "aria-describedby",
    "mb-view-changed-scheme",
  );
  await expect(page.locator('[data-view-changed-text="scheme"]')).toHaveText(
    "Other theme changed",
  );
  await expect(page.locator(VIEWPORT_DOT)).toBeHidden();
  // The deep link asked for Side by side, but the Light views are unmodified.
  await expectShownStatus(page, comparisonPaths.darkOnly, "Unmodified", false);
  await expect(page.locator('[data-diff-mode="current"]')).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  expect(diffs).toEqual([]);

  await scheme.selectOption("dark");
  await expect(page.locator(shellRoot)).toHaveAttribute(
    "data-mokly-color-scheme",
    "dark",
  );
  await expect(page.getByLabel("Viewport", { exact: true })).toHaveValue(
    "both",
  );
  await expectShownStatus(page, comparisonPaths.darkOnly, "Changed", true);

  await scheme.selectOption("light");
  await expectShownStatus(page, comparisonPaths.darkOnly, "Unmodified", false);
  expect(await dotStyle(page, SCHEME_DOT)).toEqual({
    display: "block",
    radius: "50%",
    shadow: "rgb(255, 255, 255) 0px 0px 0px 1.5px",
    width: "6px",
  });

  await page.getByRole("tab", { name: "Details", exact: true }).click();
  const row = page.locator("[data-workspace-changed-views]");
  await expect(row).toHaveText("Changed viewsMobile · Dark, Desktop · Dark");

  await chooseViewport(page, "mobile");
  await expect(page.locator(VIEWPORT_DOT)).toBeVisible();
  await expect(page.getByLabel("Viewport", { exact: true })).toHaveAttribute(
    "aria-describedby",
    "mb-view-changed-viewport",
  );

  await scheme.selectOption("dark");
  await expect(page.locator(SCHEME_DOT)).toBeHidden();
  await expect(scheme).not.toHaveAttribute("aria-describedby", /.*/);
  await expect(page.locator(VIEWPORT_DOT)).toBeVisible();
  await expectShownStatus(page, comparisonPaths.darkOnly, "Changed", true);

  await page.goto(
    `/view/${comparisonPaths.darkOnly}/?viewport=mobile&scheme=dark&comparison=side`,
  );
  await expect(page.getByLabel("Viewport", { exact: true })).toHaveValue(
    "mobile",
  );
  await expectShownStatus(page, comparisonPaths.darkOnly, "Changed", true);
  await expect(modeButton(page, "Side by side")).toHaveAttribute(
    "aria-pressed",
    "true",
  );
});

test("a light fallback rejects an ineligible comparison deep link", async ({
  page,
}) => {
  const diffs: string[] = [];
  page.on("request", (request) => {
    if (request.url().includes("/mokly-viewer/diffs/"))
      diffs.push(request.url());
  });
  await page.goto(
    `/view/${comparisonPaths.unchanged}/?viewport=mobile&scheme=dark&comparison=side`,
  );
  await expect(page.locator(shellRoot)).toHaveAttribute(
    "data-mokly-color-scheme",
    "dark",
  );
  await expectFrameSource(
    page.locator('[data-workspace-frame="mobile"]'),
    /screens\/stable\/index\.mobile\.html$/,
  );
  await expect(page.locator(".mbk-frame-mobile")).toHaveAttribute(
    "data-color-scheme-fallback",
    "",
  );
  await expectShownStatus(page, comparisonPaths.unchanged, "Unmodified", false);
  await expect(page.locator('[data-diff-mode="current"]')).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  expect(diffs).toEqual([]);
});

test("component comparisons follow changed variants while added variants stay current", async ({
  page,
}) => {
  await page.goto(`/view/${comparisonPaths.component}/`);
  await chooseViewport(page, "mobile");
  await showMode(page, "Overlay");
  await expect(
    page.locator("[data-diff-stage] [data-workspace-evidence]"),
  ).toHaveCount(0);
  await expect(page.locator("[data-workspace-evidence]")).toHaveCount(1);
  await expect(
    page.locator('[data-inspector-panel="details"] [data-workspace-evidence]'),
  ).toHaveCount(1);
  await expect(
    page.getByRole("button", { name: "Highlight components", exact: true }),
  ).toBeDisabled();
  await chooseVariant(page, "Featured");
  await expect(page.locator("[data-diff-stage] iframe").last()).toHaveAttribute(
    "data-mokly-preview-source",
    /card\/featured\/index\.mobile\.html$/,
  );
  await expect(
    page
      .locator("[data-diff-stage] .mb-pane--after iframe")
      .contentFrame()
      .getByRole("heading", { name: "Featured After" }),
  ).toBeVisible();
  // The loaded comparison adds the variant's own reasons to Details.
  await expect(page.locator('[data-inspector-panel="details"]')).toContainText(
    "Rendered content changed.",
  );
  await modeButton(page, "Current").click();
  await expect(
    page
      .frameLocator('[data-workspace-frame="mobile"]')
      .getByRole("heading", { name: "Featured After" }),
  ).toBeVisible();
  await chooseVariant(page, "Fresh");
  await expect(page.locator("[data-workspace-variant-status]")).toHaveText(
    "Fresh · Added",
  );
  await awaitRoutedDetail(page, comparisonPaths.addedVariant);
  await expect(page.locator(TOOLBAR)).toBeHidden();
  await expect(
    page
      .frameLocator('[data-workspace-frame="mobile"]')
      .getByRole("heading", { name: "Fresh card" }),
  ).toBeVisible();
});

test("Side by side stays authoritative while switching sibling variants", async ({
  page,
}) => {
  await page.goto(`/view/${comparisonPaths.component}/`);
  await chooseViewport(page, "mobile");
  await showMode(page, "Side by side");
  await chooseVariant(page, "Featured");
  await expect(modeButton(page, "Side by side")).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(page.locator("[data-diff-stage] iframe").last()).toHaveAttribute(
    "data-mokly-preview-source",
    /card\/featured\/index\.mobile\.html$/,
  );
  await page.getByRole("tab", { name: "Props", exact: true }).click();
  const props = page.getByRole("tabpanel", { name: "Props", exact: true });
  await expect(
    props.getByText("Comparisons show the saved props.", { exact: true }),
  ).toBeVisible();
  await expect(
    props.getByRole("button", { name: "Switch to Current", exact: true }),
  ).toBeVisible();
  await expect(props.getByRole("textbox")).toHaveCount(0);
  const highlight = page.getByRole("button", {
    name: "Highlight components",
    exact: true,
  });
  await expect(highlight).toBeDisabled();
  await expect(highlight).toHaveAttribute(
    "title",
    "A comparison is selected. Highlighting is available in Current.",
  );
});
