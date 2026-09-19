import { expect, test, type Page } from "@playwright/test";

const detailsRow = 'a[data-nav-row][data-route="screens/details.html"]';
const inspectorChip =
  '[data-inspector-panel="details"] [data-mokly-tag="forms"]';
const panel = "#mb-tag-picker";
const search = "[data-mokly-search]";
const toggle = "[data-mokly-tag-toggle]";
const tourRow = 'a[data-nav-row][data-route="user-flows/example-tour.html"]';
const welcomeRow = 'a[data-nav-row][data-route="screens/welcome.html"]';

function chip(tag: string): string {
  return `${panel} [data-mokly-tag="${tag}"]`;
}

async function openPicker(page: Page): Promise<void> {
  await page.click(toggle);
  await expect(page.locator(panel)).toBeVisible();
  await expect(page.locator(toggle)).toHaveAttribute("aria-expanded", "true");
}

async function expectClosed(page: Page): Promise<void> {
  await expect(page.locator(panel)).toBeHidden();
  await expect(page.locator(toggle)).toHaveAttribute("aria-expanded", "false");
}

test("the picker enters, keeps, and clears a tag term", async ({ page }) => {
  await page.goto("/view/screens/welcome.html");
  await expect(page.locator(tourRow)).toBeVisible();

  await openPicker(page);
  await expect(page.locator(chip("documents"))).toBeFocused();
  await page.click(chip("forms"));

  await expect(page.locator(search)).toHaveValue("tag:forms");
  await expectClosed(page);
  await expect(page.locator(toggle)).toBeFocused();
  await expect(page.locator(welcomeRow)).toBeVisible();
  await expect(page.locator(detailsRow)).toBeVisible();
  await expect(page.locator(tourRow)).toBeHidden();
  await expect(page.locator(inspectorChip)).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(page.locator(inspectorChip)).toHaveClass(/active/);

  await openPicker(page);
  await expect(page.locator(chip("forms"))).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(page.locator(chip("forms"))).toHaveClass(/active/);
  await expect(page.locator(chip("onboarding"))).toHaveAttribute(
    "aria-pressed",
    "false",
  );
  await expect(page.locator(chip("forms"))).toBeFocused();

  await page.click(chip("forms"));
  await expect(page.locator(search)).toHaveValue("");
  await expectClosed(page);
  await expect(page.locator(tourRow)).toBeVisible();
});

test("the open picker takes Escape ahead of the expanded frame", async ({
  page,
}) => {
  await page.goto("/view/screens/welcome.html");
  await page.fill(search, "welcome");
  await page.click(".browser-expand");
  await expect(page.locator(".browser-frame.is-expanded")).toBeVisible();

  // Synthesised state: the expand scrim covers the bar, so no real click opens the panel here.
  await page.locator(toggle).dispatchEvent("click");
  await expect(page.locator(panel)).toBeVisible();
  await page.keyboard.press("Escape");

  await expectClosed(page);
  await expect(page.locator(toggle)).toBeFocused();
  await expect(page.locator(search)).toHaveValue("welcome");
  await expect(page.locator(".browser-frame.is-expanded")).toBeVisible();

  await page.keyboard.press("Escape");
  await expect(page.locator(".browser-frame.is-expanded")).toHaveCount(0);
});

test("a click outside closes the picker without taking focus", async ({
  page,
}) => {
  await page.goto("/");
  await openPicker(page);

  await page.click(search);

  await expectClosed(page);
  await expect(page.locator(search)).toBeFocused();
});

test("an inspector tag closes the open picker and restores toggle focus", async ({
  page,
}) => {
  await page.goto("/view/screens/welcome.html");
  await page.getByRole("tab", { name: "Details", exact: true }).click();
  await openPicker(page);

  await page.locator(inspectorChip).click();

  await expect(page.locator(search)).toHaveValue("tag:forms");
  await expectClosed(page);
  await expect(page.locator(toggle)).toBeFocused();
});

test("the picker chips answer the arrow, Home, and End keys", async ({
  page,
}) => {
  await page.goto("/");
  await openPicker(page);
  await expect(page.locator(chip("documents"))).toBeFocused();
  await expect(page.locator(chip("documents"))).toHaveAttribute(
    "tabindex",
    "0",
  );
  for (const tag of ["forms", "onboarding"])
    await expect(page.locator(chip(tag))).toHaveAttribute("tabindex", "-1");

  await page.keyboard.press("ArrowRight");
  await expect(page.locator(chip("forms"))).toBeFocused();
  await expect(page.locator(chip("documents"))).toHaveAttribute(
    "tabindex",
    "-1",
  );
  await expect(page.locator(chip("forms"))).toHaveAttribute("tabindex", "0");
  await page.keyboard.press("ArrowRight");
  await expect(page.locator(chip("onboarding"))).toBeFocused();
  await page.keyboard.press("ArrowRight");
  await expect(page.locator(chip("documents"))).toBeFocused();
  await page.keyboard.press("ArrowLeft");
  await expect(page.locator(chip("onboarding"))).toBeFocused();
  await page.keyboard.press("Home");
  await expect(page.locator(chip("documents"))).toBeFocused();
  await page.keyboard.press("End");
  await expect(page.locator(chip("onboarding"))).toBeFocused();

  await page.keyboard.press("Enter");
  await expect(page.locator(search)).toHaveValue("tag:onboarding");
  await expectClosed(page);
  await expect(page.locator(toggle)).toBeFocused();
});

test("Space activates the focused picker chip natively", async ({ page }) => {
  await page.goto("/");
  await openPicker(page);
  await page.keyboard.press("End");
  await expect(page.locator(chip("onboarding"))).toBeFocused();

  await page.keyboard.press(" ");

  await expect(page.locator(search)).toHaveValue("tag:onboarding");
  await expectClosed(page);
  await expect(page.locator(toggle)).toBeFocused();
});

test("a narrow viewport drops the picker as a sheet under the bar", async ({
  page,
}) => {
  await page.setViewportSize({ height: 900, width: 420 });
  await page.goto("/");
  await openPicker(page);

  const sheet = await page.locator(panel).boundingBox();
  const bar = await page.locator(".mbk-topbar").boundingBox();
  if (!sheet || !bar) throw new Error("the picker and bar must be laid out");
  expect(Math.round(sheet.width)).toBe(Math.round(bar.width));
  expect(Math.round(sheet.x)).toBe(Math.round(bar.x));
  expect(Math.round(sheet.y)).toBe(Math.round(bar.y + bar.height));

  await page.click(chip("onboarding"));
  await expect(page.locator(search)).toHaveValue("tag:onboarding");
  await expectClosed(page);
});
