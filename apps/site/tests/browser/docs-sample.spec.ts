import { type Page, expect, test } from "@playwright/test";

import {
  SAMPLE_PAGE,
  VIEWS,
  band,
  box,
  centre,
  dimmedLines,
  expectInside,
  expectMeet,
  line,
  litLines,
  mark,
  option,
  shownWire,
  view,
  wire,
} from "./sample.js";

/** Source lines of the sample, as its code panel shows them. */
const HEADING = "<h1>Welcome, {{name}}</h1>";
const READY = '<p mokly-if="$returning">Your workspace is ready.</p>';

/**
 * Each view keeps its viewport's width under its device chrome, and its
 * scaled frame and size tag lie inside the band, which lies inside the sheet.
 */
async function expectViewsInside(page: Page): Promise<void> {
  await page.goto(SAMPLE_PAGE);
  for (const [name, title, size] of [
    ["Mobile", VIEWS.mobile, [390, 800]],
    ["Desktop", VIEWS.desktop, [1280, 760]],
  ] as const) {
    await option(page, name).click();
    const frame = view(page, title);
    await expect(frame).toBeVisible();
    expect(
      await frame.evaluate((node) =>
        node instanceof HTMLIFrameElement
          ? [node.contentWindow?.innerWidth, node.contentWindow?.innerHeight]
          : [],
      ),
      `${name}: the document's viewport`,
    ).toEqual(size);
    // Every box is read at one scroll position, after the click.
    const [sheet, area, scaled, tag] = await Promise.all([
      box(page.locator(".site-page-sheet")),
      box(band(page)),
      box(frame),
      box(band(page).locator(".site-sel-size").filter({ visible: true })),
    ]);
    expectInside(scaled, area, `${name}: the view in the band`);
    expectInside(tag, area, `${name}: the size tag in the band`);
    expectInside(area, sheet, `${name}: the band in the sheet`);
  }
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
}

test("each code line of the sample takes its own rows, with no blank row after it", async ({
  page,
}) => {
  await page.goto(SAMPLE_PAGE);
  const lines = band(page).locator(".site-code-line");
  await expect(lines).toHaveCount(16);
  const rows = await lines.evaluateAll((all) =>
    all.map((code) => {
      const { bottom, top } = code.getBoundingClientRect();
      return {
        bottom,
        row: parseFloat(getComputedStyle(code).lineHeight),
        top,
      };
    }),
  );
  // The first line, `---`, is one row, and each line starts where the line
  // before it ends.
  expect(rows[0]!.bottom - rows[0]!.top).toBeCloseTo(rows[0]!.row, 0);
  expect(
    rows
      .slice(1)
      .map((row, index) => Math.round(row.top - rows[index]!.bottom)),
  ).toEqual(rows.slice(1).map(() => 0));
});

test("the controls switch the frame to the chosen view and dim the lines it leaves out", async ({
  page,
}) => {
  await page.goto(SAMPLE_PAGE);
  const radio = (name: string) =>
    page.getByRole("radio", { exact: true, name });
  await expect(radio("Mobile")).toBeChecked();
  await expect(radio("Welcome")).toBeChecked();
  await expect(view(page, VIEWS.mobile)).toBeVisible();
  await expect.poll(() => dimmedLines(page)).toEqual([15]);

  await option(page, "Desktop").click();
  await expect(radio("Desktop")).toBeChecked();
  await expect(view(page, VIEWS.desktop)).toBeVisible();
  await expect(view(page, VIEWS.mobile)).toBeHidden();
  await expect.poll(() => dimmedLines(page)).toEqual([14]);

  await option(page, "First visit").click();
  await expect(radio("First visit")).toBeChecked();
  await expect(view(page, VIEWS.desktopFirstVisit)).toBeVisible();
  await expect(view(page, VIEWS.desktop)).toBeHidden();
  await expect.poll(() => dimmedLines(page)).toEqual([13, 14]);
});

test(
  "beside the code, the wire joins the lit heading's line to the heading at the frame's edge",
  { tag: "@desktop" },
  async ({ page }) => {
    await page.goto(SAMPLE_PAGE);
    const lit = line(page, HEADING);
    await lit.scrollIntoViewIfNeeded();
    await expect.poll(() => litLines(page)).toEqual([12]);
    await expect(mark(page)).toHaveText("h1");
    await expect(wire(page)).toBeVisible();
    const frame = view(page, VIEWS.mobile);
    const heading = frame
      .contentFrame()
      .getByRole("heading", { name: "Welcome, Ada" });
    const [panel, from, screen, to, source, element, picked] =
      await Promise.all([
        box(band(page).locator(".site-code")),
        box(lit),
        box(frame),
        box(heading),
        box(wire(page).locator(".site-docs-sample-end--source")),
        box(wire(page).locator(".site-docs-sample-end--element")),
        box(mark(page)),
      ]);
    expectMeet(
      centre(source),
      { x: panel.x + panel.width, y: centre(from).y },
      "the wire at the line",
    );
    expectMeet(
      centre(element),
      { x: screen.x, y: centre(to).y },
      "the wire at the heading",
    );
    expectMeet(
      { x: picked.x, y: centre(picked).y },
      { x: to.x, y: centre(to).y },
      "the mark over the heading",
    );
  },
);

test(
  "pointing at a line lights it and its element, and pointing at an element lights its line",
  { tag: "@desktop" },
  async ({ page }) => {
    await page.goto(SAMPLE_PAGE);
    const ready = line(page, READY);
    await ready.scrollIntoViewIfNeeded();
    await expect.poll(() => litLines(page)).toEqual([12]);
    const document = view(page, VIEWS.mobile).contentFrame();

    await ready.hover();
    await expect.poll(() => litLines(page)).toEqual([13]);
    await expect(mark(page)).toHaveText("p");
    const paragraph = await box(document.getByText("Your workspace is ready."));
    const over = await box(mark(page));
    expectMeet(
      { x: over.x, y: centre(over).y },
      { x: paragraph.x, y: centre(paragraph).y },
      "the mark over the paragraph",
    );

    // The frame takes no pointer itself; the reader points at the text
    // where the frame shows it.
    const navigation = await box(document.getByText("Compact navigation"));
    await page.mouse.move(navigation.x + 4, centre(navigation).y);
    await expect.poll(() => litLines(page)).toEqual([14]);
    const moved = await box(mark(page));
    expectMeet(
      { x: moved.x, y: centre(moved).y },
      { x: navigation.x, y: centre(navigation).y },
      "the mark over the navigation",
    );

    // The Desktop view leaves that line out, so its first heading lights.
    await option(page, "Desktop").click();
    await expect.poll(() => dimmedLines(page)).toEqual([14]);
    await expect.poll(() => litLines(page)).toEqual([12]);
    await expect(mark(page)).toHaveText("h1");
  },
);

test.describe("on a touch screen", () => {
  test.use({ hasTouch: true });

  test(
    "stacked, the band draws no wire, and tapping a line or an element lights the pair",
    { tag: "@mobile" },
    async ({ page }) => {
      await page.goto(SAMPLE_PAGE);
      const ready = line(page, READY);
      await ready.scrollIntoViewIfNeeded();
      await expect.poll(() => litLines(page)).toEqual([12]);
      await expect(mark(page)).toHaveText("h1");
      const frame = view(page, VIEWS.mobile);
      const [panel, screen] = await Promise.all([
        box(band(page).locator(".site-code")),
        box(frame),
      ]);
      expect(screen.y).toBeGreaterThan(panel.y + panel.height);
      await expect(wire(page)).toHaveCount(1);
      await expect(shownWire(page)).toHaveCount(0);

      await ready.tap();
      await expect.poll(() => litLines(page)).toEqual([13]);
      await expect(mark(page)).toHaveText("p");
      const navigation = await box(
        frame.contentFrame().getByText("Compact navigation"),
      );
      await page.touchscreen.tap(navigation.x + 4, centre(navigation).y);
      await expect.poll(() => litLines(page)).toEqual([14]);
      await expect(shownWire(page)).toHaveCount(0);
    },
  );
});

for (const width of [320, 390]) {
  test(
    `at ${width}px each view keeps its viewport width and lies inside the band and the sheet`,
    { tag: "@mobile" },
    async ({ page }) => {
      await page.setViewportSize({ height: 900, width });
      await expectViewsInside(page);
    },
  );
}

test(
  "at 1440px each view keeps its viewport width and lies inside the band and the sheet",
  { tag: "@desktop" },
  async ({ page }) => {
    await expectViewsInside(page);
  },
);

test.describe("without script", () => {
  test.use({ javaScriptEnabled: false });

  test("the band shows its first view with its dimmed lines, without the controls or the wire", async ({
    page,
  }) => {
    await page.goto(SAMPLE_PAGE);
    await expect(band(page).locator("iframe")).toHaveCount(4);
    await expect(view(page, VIEWS.mobile)).toBeVisible();
    for (const title of [
      VIEWS.desktop,
      VIEWS.mobileFirstVisit,
      VIEWS.desktopFirstVisit,
    ])
      await expect(view(page, title)).toBeHidden();
    const controls = page.getByRole("group", {
      includeHidden: true,
      name: "Viewport",
    });
    await expect(controls).toHaveCount(1);
    await expect(controls).toBeHidden();
    await expect(wire(page)).toHaveCount(1);
    await expect(shownWire(page)).toHaveCount(0);
    await expect.poll(() => dimmedLines(page)).toEqual([15]);
    expect(await litLines(page)).toEqual([]);
  });
});
