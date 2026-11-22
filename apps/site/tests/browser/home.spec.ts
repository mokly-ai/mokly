import { expect, test } from "@playwright/test";

import {
  EXTERNAL_LINKS,
  GET_STARTED_PATH,
  SITE_PATHS,
} from "../../src/navigation.js";

import { NARROW_WIDTH, openLargeText, scrollWidth } from "./large-text.js";

/** The approved hero lead, which the page description repeats. */
const LEAD =
  "Generate an interactive mockup of your entire app using your existing React, HTML and CSS components.";

test("the hero reads as its heading, its lead and its two actions", async ({
  page,
}) => {
  await page.goto(SITE_PATHS.home);
  // `\\s` also matches the no-break space that keeps "in code." together.
  await expect(page.locator("#hero")).toMatchAriaSnapshot(`
    - /children: equal
    - heading /^Design in\\scode\\.$/ [level=1]
    - paragraph: ${LEAD}
    - link "Get started"
    - link "Download for Mac"
  `);
});

test("the home description and its social metadata repeat the hero lead", async ({
  page,
}) => {
  await page.goto(SITE_PATHS.home);
  for (const selector of [
    'meta[name="description"]',
    'meta[property="og:description"]',
    'meta[name="twitter:description"]',
  ])
    await expect(page.locator(selector)).toHaveAttribute("content", LEAD);
});

test("both Get started actions open the Install guide", async ({ page }) => {
  await page.goto(SITE_PATHS.home);
  const actions = page
    .getByRole("main")
    .getByRole("link", { name: "Get started" });
  await expect(actions).toHaveCount(2);
  for (const action of await actions.all()) {
    await expect(action).toHaveAttribute("href", GET_STARTED_PATH);
  }
  await actions.first().click();
  await expect(page).toHaveURL(new RegExp(`${GET_STARTED_PATH}$`));
  await expect(
    page.getByRole("main").getByRole("heading", { level: 1 }),
  ).toHaveText("Install");
});

test("Download for Mac opens the desktop releases", async ({ page }) => {
  await page.goto(SITE_PATHS.home);
  const action = page
    .getByRole("main")
    .getByRole("link", { name: "Download for Mac" });
  await expect(action).toHaveAttribute("href", EXTERNAL_LINKS.desktopReleases);
});

test("View on GitHub opens the open-source repository", async ({ page }) => {
  await page.goto(SITE_PATHS.home);
  const action = page
    .getByRole("main")
    .getByRole("link", { name: "View on GitHub" });
  await expect(action).toHaveAttribute("href", EXTERNAL_LINKS.github);
});

test("the features hold the Browse, Review and Edit modules in order", async ({
  page,
}) => {
  await page.goto(SITE_PATHS.home);
  await expect(page.getByRole("region", { name: /^Browse, review, edit\./ }))
    .toMatchAriaSnapshot(`
    - heading "Browse, review, edit. One place for all of it." [level=2]
    - paragraph: Every branch becomes a catalogue your whole team can open.
    - article "A visual diff for every branch.":
      - paragraph: 01 Browse
      - heading "A visual diff for every branch." [level=3]
    - article "Sticky comments.":
      - paragraph: 02 Review
      - heading "Sticky comments." [level=3]
    - article "Ask for the change beside the screen.":
      - paragraph: 03 Edit
      - heading "Ask for the change beside the screen." [level=3]
  `);
});

test("the Specs panel shows from 1200px only @desktop", async ({ page }) => {
  await page.goto(SITE_PATHS.home);
  const specs = page.getByRole("navigation", { name: "Page sections" });
  await expect(specs).toBeVisible();
  for (const [width, shown] of [
    [1200, true],
    [1199, false],
    [767, false],
  ] as const) {
    await page.setViewportSize({ width, height: 900 });
    await expect(specs, `${width}px`).toBeVisible({ visible: shown });
  }
});

test("Specs marks the section in view as the reader scrolls @desktop", async ({
  page,
}) => {
  await page.goto(SITE_PATHS.home);
  const specs = page.getByRole("navigation", { name: "Page sections" });
  const row = (name: string) => specs.getByRole("link", { exact: true, name });
  await expect(row("Hero")).toHaveAttribute("aria-current", "location");

  const review = page.getByRole("article", { name: "Sticky comments." });
  const box = await review.boundingBox();
  await page.mouse.move(720, 450);
  await page.mouse.wheel(0, (box?.y ?? 0) - 160);
  await expect(row("02 Review")).toHaveAttribute("aria-current", "location");
  await expect(row("Hero")).not.toHaveAttribute("aria-current");
  await expect(row("02 Review")).not.toBeFocused();

  await page.keyboard.press("End");
  await expect(row("Footer")).toHaveAttribute("aria-current", "location");
  await expect(row("02 Review")).not.toHaveAttribute("aria-current");
  await expect(row("Footer")).not.toBeFocused();
});

test("a Specs link moves the page to its section @desktop", async ({
  page,
}) => {
  await page.goto(SITE_PATHS.home);
  const specs = page.getByRole("navigation", { name: "Page sections" });
  await specs.getByRole("link", { exact: true, name: "03 Edit" }).click();
  await expect(page).toHaveURL(/#edit$/);
  await expect(
    page.getByRole("heading", {
      name: "Ask for the change beside the screen.",
    }),
  ).toBeInViewport();
  await expect(
    specs.getByRole("link", { exact: true, name: "03 Edit" }),
  ).toHaveAttribute("aria-current", "location");
});

test(
  "at 200% text in a 320px window the home does not scroll sideways",
  { tag: "@mobile" },
  async ({ page }) => {
    await openLargeText(page, SITE_PATHS.home);
    await expect
      .poll(() => scrollWidth(page))
      .toBeLessThanOrEqual(NARROW_WIDTH);
  },
);
