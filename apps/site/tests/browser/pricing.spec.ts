import { expect, test } from "@playwright/test";

import { PRICING_GROUPS } from "../../src/components/pricing/compare-rows.js";
import {
  APP_PATHS,
  GET_STARTED_PATH,
  SITE_PATHS,
} from "../../src/navigation.js";

import { NARROW_WIDTH, openLargeText, scrollWidth } from "./large-text.js";

/**
 * The pricing page: where its actions lead, the compare table's semantics,
 * the depictions that assistive technology does not read, the targets, the
 * sticky plan heads and the phone sizes of the group heads and the Mokly CLI
 * box. The page walk of pages.spec.ts checks its title, its heading and the
 * shared accessibility rules.
 */

/** The compare table, named by its caption. */
const TABLE = "What each plan includes";

test("the plan actions and the docs link open their targets", async ({
  page,
}) => {
  await page.goto(SITE_PATHS.pricing);
  const main = page.getByRole("main");
  for (const [name, href] of [
    ["Get started", GET_STARTED_PATH],
    ["Create an account", APP_PATHS.signUp],
    ["Start a 7-day trial", APP_PATHS.signUp],
    ["Read Plans and billing", "/docs/cloud/plans-and-billing/"],
  ] as const) {
    await expect(
      main.getByRole("link", { exact: true, name }),
      name,
    ).toHaveAttribute("href", href);
  }
  await main.getByRole("link", { name: "Read Plans and billing" }).click();
  await expect(
    page.getByRole("main").getByRole("heading", { level: 1 }),
  ).toHaveText("Plans and billing");
});

test("the compare table keeps its table roles and reads each check and dash", async ({
  page,
}) => {
  await page.goto(SITE_PATHS.pricing);
  // A check reads "Included" and a dash "Not included": both are drawn
  // hidden from assistive technology, beside their words.
  await expect(page.getByRole("table", { name: TABLE })).toMatchAriaSnapshot(`
    - table "${TABLE}":
      - rowgroup:
        - row:
          - /children: equal
          - columnheader "Property"
          - columnheader "Open source"
          - columnheader "Free"
          - columnheader "Team"
      - rowgroup:
        - row:
          - rowheader "Open source"
        - row:
          - /children: equal
          - rowheader "Mokly CLI MIT license"
          - cell "Included"
          - cell "Included"
          - cell "Included"
      - rowgroup:
        - row:
          - rowheader "Mokly Cloud"
        - row:
          - /children: equal
          - rowheader "Publish to a private project"
          - cell "Not included"
          - cell "Not included"
          - cell "Included"
  `);
});

test("the plan frames and the threads hide their depictions from assistive technology", async ({
  page,
}) => {
  await page.goto(SITE_PATHS.pricing);
  // The frame label, the selection with its size tag and Maya's cursor draw
  // over the Team frame; the pin and the avatars draw in each thread.
  await expect(page.getByRole("article", { exact: true, name: "Team" }))
    .toMatchAriaSnapshot(`
    - article "Team":
      - /children: equal
      - heading "Team" [level=3]
      - paragraph: For teams with private catalogues.
      - paragraph: $20 per Editor a month . Owners, admins and members
      - paragraph: $5 per Collaborator a month . Reviewers
      - link "Start a 7-day trial"
      - paragraph: In US dollars, before tax.
      - list:
        - listitem: Private projects in the same workspace.
        - listitem: New projects start private.
        - listitem: Publish and build private projects in the cloud.
        - listitem: One trial per workspace.
  `);
  await expect(page.getByRole("article", { name: "How does the trial work?" }))
    .toMatchAriaSnapshot(`
    - article "How does the trial work?":
      - /children: equal
      - paragraph: Trial Resolved
      - paragraph: Maya Design
      - heading "How does the trial work?" [level=3]
      - paragraph: Mokly
      - paragraph: Team begins with a 7-day trial, offered once per workspace. The billing pane shows the day it ends. After that, Team is billed monthly.
  `);
});

test("every link and button on the pricing page is at least 44px tall", async ({
  page,
}) => {
  await page.goto(SITE_PATHS.pricing);
  const main = page.getByRole("main");
  const controls = [
    ...(await main.getByRole("link").all()),
    ...(await main.getByRole("button").all()),
  ];
  expect(controls.length).toBeGreaterThan(0);
  for (const control of controls) {
    await control.scrollIntoViewIfNeeded();
    await expect
      .poll(
        async () => (await control.boundingBox())?.height ?? 0,
        (await control.textContent()) ?? "",
      )
      .toBeGreaterThanOrEqual(44);
  }
});

test("the plan heads stay under the tool bar while the compare table scrolls", async ({
  page,
}) => {
  await page.goto(SITE_PATHS.pricing);
  const table = page.getByRole("table", { name: TABLE });
  await table
    .getByRole("rowheader", { name: "Annual price" })
    .scrollIntoViewIfNeeded();
  const bar = page.getByRole("banner");
  const head = table.getByRole("columnheader", { exact: true, name: "Team" });
  // A stuck head starts where the bar ends; a head that scrolled away with
  // the table would sit above the window.
  await expect
    .poll(async () => {
      const [barBox, headBox] = await Promise.all([
        bar.boundingBox(),
        head.boundingBox(),
      ]);
      return Math.round(
        (headBox?.y ?? 0) - ((barBox?.y ?? 0) + (barBox?.height ?? 0)),
      );
    })
    .toBe(0);
});

test(
  "on a phone the group heads take the label size and the Mokly CLI box closes 24px under its frame",
  { tag: "@mobile" },
  async ({ page }) => {
    await page.goto(SITE_PATHS.pricing);
    // The group heads are mono labels, not cells. No size tag or cursor sits
    // under the Open source frame, so its box needs no room for one.
    const table = page.getByRole("table", { name: TABLE });
    for (const { title } of PRICING_GROUPS)
      await expect(
        table.getByRole("rowheader", { exact: true, name: title }),
        title,
      ).toHaveCSS("font-size", "11px");
    await expect(page.getByRole("group", { name: "Mokly CLI" })).toHaveCSS(
      "padding-bottom",
      "24px",
    );
  },
);

test(
  "at 200% text in a 320px window the pricing page does not scroll sideways",
  { tag: "@mobile" },
  async ({ page }) => {
    await openLargeText(page, SITE_PATHS.pricing);
    await expect
      .poll(() => scrollWidth(page))
      .toBeLessThanOrEqual(NARROW_WIDTH);
  },
);
