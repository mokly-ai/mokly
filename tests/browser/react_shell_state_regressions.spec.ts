import { expect, test, type Locator, type Page } from "@playwright/test";

const componentPath = "/view/design/library/inspector/inspector.html";
const componentRow =
  'a[data-nav-row][data-route="design/library/inspector/inspector.html"]';
const fragment = "react-native-stylesheet";

test("sequential search editing preserves spaces and typed tag terms", async ({
  page,
}) => {
  await page.goto("/view/screens/welcome.html");
  const search = page.getByRole("searchbox", { name: "Search catalogue" });

  await search.pressSequentially("welcome tag:forms");

  await expect(search).toHaveValue("welcome tag:forms");
  await page.locator("[data-mokly-tag-toggle]").click();
  await expect(
    page.locator('#mb-tag-picker [data-mokly-tag="forms"]'),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator('[data-entry-id="example-welcome"]')).toBeVisible();
});

test("a direct Serve URL restores its variant and fragment after refresh", async ({
  page,
}) => {
  const url = `${componentPath}?variant=props&fragment=${fragment}`;
  await page.goto(url);
  await expectInitialComponentQuery(page);

  await page.reload();
  await expectInitialComponentQuery(page);
});

test("invalid variant URLs remain unavailable through Back and Forward", async ({
  page,
}) => {
  await page.goto(`${componentPath}?variant=`);
  await expect(page.locator("[data-workspace-error]")).toHaveText(
    "This saved variant is unavailable. Choose another variant.",
  );

  const duplicate = `${componentPath}?variant=details&variant=props`;
  await page.goto(duplicate);
  await expect(page.locator("[data-workspace-error]")).toHaveText(
    "Choose one saved variant.",
  );
  await expect.poll(() => variantValues(page)).toEqual(["details", "props"]);

  await page.getByLabel("Saved variant", { exact: true }).selectOption("props");
  await expect(page.locator("[data-workspace-error]")).toBeHidden();
  await expect.poll(() => variantValues(page)).toEqual(["props"]);

  await page.goBack();
  await expect(page.locator("[data-workspace-error]")).toHaveText(
    "Choose one saved variant.",
  );
  await expect.poll(() => variantValues(page)).toEqual(["details", "props"]);

  await page.goForward();
  await expect(page.locator("[data-workspace-error]")).toBeHidden();
  await expect.poll(() => variantValues(page)).toEqual(["props"]);
});

test("query-only variant navigation scrolls the active row back into view", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 620 });
  await page.goto(componentPath);
  const pane = page.locator("[data-mokly-nav-scroll]");
  const row = page.locator(componentRow);
  await moveOutsidePane(pane);
  expect(await rowIsInsidePane(pane, row)).toBe(false);

  await page.getByLabel("Saved variant", { exact: true }).selectOption("props");

  await expect(page).toHaveURL(/\?variant=props$/);
  await expect.poll(() => rowIsInsidePane(pane, row)).toBe(true);
});

async function expectInitialComponentQuery(page: Page): Promise<void> {
  await expect(page.getByLabel("Saved variant", { exact: true })).toHaveValue(
    "props",
  );
  for (const viewport of ["mobile", "desktop"])
    await expect(
      page.locator(`iframe[data-workspace-frame="${viewport}"]`),
    ).toHaveAttribute(
      "src",
      new RegExp(
        `inspector\\.variants/props\\.${viewport}\\.html#${fragment}$`,
      ),
    );
}

function variantValues(page: Page): Promise<string[]> {
  return page.evaluate(() =>
    new URL(location.href).searchParams.getAll("variant"),
  );
}

async function moveOutsidePane(pane: Locator): Promise<void> {
  await pane.evaluate((element, selector) => {
    const active = element.querySelector<HTMLElement>(selector);
    if (!active) throw new Error("active catalogue row is unavailable");
    element.style.height = "120px";
    element.style.maxHeight = "120px";
    element.style.minHeight = "120px";
    element.scrollTop = 0;
    const paneBox = element.getBoundingClientRect();
    const rowBox = active.getBoundingClientRect();
    if (rowBox.top >= paneBox.top && rowBox.bottom <= paneBox.bottom)
      element.scrollTop = element.scrollHeight;
  }, componentRow);
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
