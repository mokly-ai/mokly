import { type Locator, type Page, expect, test } from "@playwright/test";

const INSTALL = "/docs/start/install/";

/** The top of a row inside its scrolling tree. */
async function rowTop(row: Locator): Promise<number> {
  return row.evaluate((link) => {
    const tree = link.closest(".site-doc-tree-scroll");
    if (!tree) throw new Error("the row is outside the scrolling tree");
    return link.getBoundingClientRect().top - tree.getBoundingClientRect().top;
  });
}

/** Scroll the window with the wheel over the page frame. */
async function scrollPage(page: Page, by: number): Promise<void> {
  await page.mouse.move(720, 600);
  await page.mouse.wheel(0, by);
}

test(
  "the Layers and Inspect panels stay below the tool bar as the page scrolls",
  { tag: "@desktop" },
  async ({ page }) => {
    await page.goto(INSTALL);
    await scrollPage(page, 1600);
    await expect
      .poll(() => page.evaluate(() => window.scrollY))
      .toBeGreaterThan(1000);
    const bar = await page.getByRole("banner").boundingBox();
    const height = page.viewportSize()?.height ?? 0;
    for (const panel of [
      page.getByRole("navigation", { name: "Documentation" }),
      page.getByRole("complementary", { name: "Inspect" }),
    ]) {
      const box = await panel.boundingBox();
      if (!bar || !box) throw new Error("a panel or the tool bar has no box");
      expect(box.y).toBeGreaterThanOrEqual(bar.y + bar.height);
      expect(box.y).toBeCloseTo(72, 0);
      expect(box.y + box.height).toBeLessThanOrEqual(height);
    }
  },
);

test(
  "the scroll spy marks the section in view and shows the reading progress",
  { tag: "@desktop" },
  async ({ page }) => {
    await page.goto(INSTALL);
    const outline = page.getByRole("navigation", { name: "On this page" });
    const progress = page
      .getByRole("complementary", { name: "Inspect" })
      .getByText(/^\d+%$/);
    const first = outline.getByRole("link", { name: "Install the package" });
    const third = outline.getByRole("link", { name: "Pin a version" });
    await expect(first).toHaveAttribute("aria-current", "location");
    await expect(progress).toHaveText("0%");

    await third.click();
    await expect(third).toHaveAttribute("aria-current", "location");
    await expect(outline.locator('[aria-current="location"]')).toHaveCount(1);
    await expect(progress).not.toHaveText("0%");
    // The index of the section in view takes the signal ink, and the first
    // section's index is muted again.
    const index = (name: string) =>
      page
        .getByRole("heading", { level: 2, name })
        .evaluate((heading) => getComputedStyle(heading, "::before").color);
    expect(await index("Pin a version")).not.toBe(
      await index("Install the package"),
    );

    await scrollPage(page, 20_000);
    await expect(progress).toHaveText("100%");
  },
);

test(
  "below 1280px On this page sits in a closed disclosure in place of the Inspect panel",
  { tag: "@desktop" },
  async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(INSTALL);
    const inspect = page.getByRole("complementary", { name: "Inspect" });
    const disclosure = page.locator("details").filter({
      has: page.locator("summary", { hasText: "On this page" }),
    });
    await expect(inspect).toBeVisible();
    await expect(disclosure).toBeHidden();

    await page.setViewportSize({ width: 1279, height: 900 });
    await expect(inspect).toBeHidden();
    await expect(disclosure).toBeVisible();
    await expect(disclosure).toHaveJSProperty("open", false);
  },
);

test(
  "the Layers tree keeps its place from 1024px, and below it the sub-bar takes over",
  { tag: "@desktop" },
  async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 900 });
    await page.goto(INSTALL);
    const layers = page.getByRole("navigation", { name: "Documentation" });
    await expect(layers).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Getting started Install" }),
    ).toBeHidden();

    const row = layers.getByRole("link", { name: "Validate a catalogue" });
    // Bring the row to the middle of the tree, as a reader scrolls it there.
    await row.evaluate((link) => {
      const tree = link.closest(".site-doc-tree-scroll");
      if (!tree) throw new Error("the row is outside the scrolling tree");
      tree.scrollTop +=
        link.getBoundingClientRect().top -
        tree.getBoundingClientRect().top -
        tree.clientHeight / 2;
    });
    const before = await rowTop(row);
    await row.click();
    await expect(page).toHaveURL(/\/docs\/cli\/check\/$/);
    await expect(row).toHaveAttribute("aria-current", "page");
    expect(Math.abs((await rowTop(row)) - before)).toBeLessThan(2);

    await page.setViewportSize({ width: 1023, height: 900 });
    await expect(layers).toBeHidden();
    await expect(
      page.getByRole("button", { name: "CLI reference Validate a catalogue" }),
    ).toBeVisible();
  },
);

test("the page frame takes the mockup's width and the docs headings their own type", async ({
  page,
}) => {
  const mobile = (page.viewportSize()?.width ?? 0) < 768;
  await page.goto("/docs/reference/upload-exchange/");
  const sheet = await page.locator(".site-page-sheet").boundingBox();
  expect(sheet?.width).toBe(mobile ? 370 : 856);
  await expect(
    page.getByRole("heading", { exact: true, level: 3, name: "Plan" }),
  ).toHaveCSS("font-size", mobile ? "18px" : "20px");
});
