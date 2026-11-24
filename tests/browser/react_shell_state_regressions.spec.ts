import { expect, type Locator, type Page } from "@playwright/test";

import { test } from "./browser_test.js";
import { canvasFrame } from "./workspace_actions.js";

const component = "example/components/action";
const variant = `${component}/disabled`;
const componentPath = `/view/${component}/`;
const variantPath = `/view/${variant}/`;
const variantRow =
  'a[data-nav-row][data-route="example/components/action/disabled/index.html"]';
const fragment = "react-native-stylesheet";

test("sequential search editing preserves spaces and typed tag terms", async ({
  page,
}) => {
  await page.goto("/view/example/screens/welcome/");
  const search = page.getByRole("searchbox", { name: "Search catalogue" });

  await search.pressSequentially("welcome tag:forms");

  await expect(search).toHaveValue("welcome tag:forms");
  await page.locator("[data-mokly-tag-toggle]").click();
  await expect(
    page.locator('#mb-tag-picker [data-mokly-tag="forms"]'),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(
    page.locator('[data-entry-id="example/screens/welcome"]'),
  ).toBeVisible();
});

test("a direct Serve URL restores its variant entry and fragment after refresh", async ({
  page,
}) => {
  const url = `${variantPath}?fragment=${fragment}`;
  await page.goto(url);
  await expectInitialVariantEntry(page);

  await page.reload();
  await expectInitialVariantEntry(page);
});

test("a history navigation to a variant entry scrolls its row back into view", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 620 });
  await page.goto(variantPath);
  await page
    .locator(
      'a[data-nav-row][data-route="example/components/action/index.html"]',
    )
    .click();
  await expect(page).toHaveURL(new RegExp(`${componentPath}$`, "u"));
  const pane = page.locator("[data-mokly-nav-scroll]");
  const row = page.locator(variantRow);
  await moveOutsidePane(pane, variantRow);
  expect(await rowIsInsidePane(pane, row)).toBe(false);

  await page.goBack();

  await expect(page).toHaveURL(
    /\/view\/example\/components\/action\/disabled\/$/,
  );
  await expect.poll(() => rowIsInsidePane(pane, row)).toBe(true);
});

async function expectInitialVariantEntry(page: Page): Promise<void> {
  // The routed saved variant's frame is selected, so Inspect's Variants
  // checks its row.
  await expect(
    page.locator('[data-inspect-section="variants"] [data-checked]'),
  ).toHaveText("Disabled");
  // The variant's own row of the set opens at the fragment, and the parent's
  // row, another entry, does not.
  await expect(
    page.locator(
      `${canvasFrame("desktop")}[data-workspace-variant="${variant}"]`,
    ),
  ).toHaveAttribute(
    "src",
    new RegExp(`action/disabled/index\\.desktop\\.html#${fragment}$`),
  );
  await expect(
    page.locator(
      `${canvasFrame("desktop")}[data-workspace-variant="${component}"]`,
    ),
  ).toHaveAttribute("src", /components\/action\/index\.desktop\.html$/);
}

/** Align the fixture edges so integer scroll offsets can meet exact containment. */
async function moveOutsidePane(pane: Locator, selector: string): Promise<void> {
  await pane.evaluate((element, selector) => {
    const active = element.querySelector<HTMLElement>(selector);
    if (!active) throw new Error("active catalogue row is unavailable");
    const relativeBottom =
      active.getBoundingClientRect().bottom -
      element.getBoundingClientRect().top;
    const height = `${120 + relativeBottom - Math.floor(relativeBottom)}px`;
    element.style.height = height;
    element.style.maxHeight = height;
    element.style.minHeight = height;
    element.scrollTop = 0;
    const paneBox = element.getBoundingClientRect();
    const rowBox = active.getBoundingClientRect();
    if (rowBox.top >= paneBox.top && rowBox.bottom <= paneBox.bottom)
      element.scrollTop = element.scrollHeight;
  }, selector);
}

async function rowIsInsidePane(pane: Locator, row: Locator): Promise<boolean> {
  const paneBox = await pane.boundingBox();
  const rowBox = await row.boundingBox();
  if (!paneBox || !rowBox) return false;
  return (
    rowBox.y >= paneBox.y &&
    rowBox.y + rowBox.height <= paneBox.y + paneBox.height
  );
}
