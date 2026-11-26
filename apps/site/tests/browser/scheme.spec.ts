import {
  type Locator,
  type Page,
  type TestInfo,
  expect,
  test,
} from "@playwright/test";

import { SITE_PATHS } from "../../src/navigation.js";

import { focusGlows } from "./accessibility.js";

/**
 * The footer's scheme control and the scheme island, in a real browser: a
 * choice applies at once and holds across pages, `?scheme=` holds for one
 * view, a kept choice is in force before the page body exists, the keyboard
 * moves between the options, and without script the page follows the system
 * scheme. Each project emulates a system scheme, and each test chooses the
 * other one, so a choice is visible. The control behaves the same at every
 * width, so these tests run in the desktop projects, once in each system
 * scheme; the chrome spec checks its targets at both widths.
 */

type Scheme = "light" | "dark";

/** Runs a test in the desktop projects only. */
const DESKTOP = { tag: ["@desktop", "@scheme"] };

/** The label of each option, which names its radio. */
const LABEL: Readonly<Record<Scheme, string>> = {
  dark: "Dark",
  light: "Light",
};

/** The project's system scheme, and the other scheme. */
function schemes(info: TestInfo): { other: Scheme; system: Scheme } {
  const system = info.project.use.colorScheme === "dark" ? "dark" : "light";
  return { other: system === "dark" ? "light" : "dark", system };
}

/** The footer's scheme control. */
function control(page: Page): Locator {
  return page.getByRole("group", { name: "Color scheme" });
}

/** The radio of one option. */
function radio(page: Page, scheme: Scheme): Locator {
  return control(page).getByRole("radio", { name: LABEL[scheme] });
}

/** The visible segment of one option, which the reader presses. */
function segment(page: Page, scheme: Scheme): Locator {
  return control(page).getByText(LABEL[scheme], { exact: true });
}

/** The page draws in a scheme: the root resolves to its token set. */
async function expectScheme(page: Page, scheme: Scheme): Promise<void> {
  await expect(page.locator("html")).toHaveCSS("color-scheme", scheme);
}

/** Follow a footer link, as a reader does, and wait for its page. */
async function follow(page: Page, name: string, route: string): Promise<void> {
  await page.getByRole("contentinfo").getByRole("link", { name }).click();
  await expect(page).toHaveURL(new RegExp(`${route}$`));
}

test(
  "a chosen scheme applies at once and holds across a reload and pages",
  DESKTOP,
  async ({ page }, info) => {
    const { other, system } = schemes(info);
    await page.goto(SITE_PATHS.terms);
    await expect(radio(page, system)).toBeChecked();
    await follow(page, "Privacy", SITE_PATHS.privacy);
    await segment(page, other).click();
    await expectScheme(page, other);
    await expect(radio(page, other)).toBeChecked();
    await page.reload();
    await expectScheme(page, other);
    await expect(radio(page, other)).toBeChecked();
    // Going back shows the first page again, loaded anew or from the
    // back-forward cache. Either way the kept choice wins over the state that
    // the browser restores into its radios.
    await page.goBack();
    await expect(page).toHaveURL(new RegExp(`${SITE_PATHS.terms}$`));
    await expectScheme(page, other);
    await expect(radio(page, other)).toBeChecked();
  },
);

test(
  "?scheme= selects a scheme for one view and stays out of every link",
  DESKTOP,
  async ({ page }, info) => {
    const { other, system } = schemes(info);
    await page.goto(`${SITE_PATHS.terms}?scheme=${other}`);
    await expectScheme(page, other);
    await expect(radio(page, other)).toBeChecked();
    // Every address on the page, the canonical one and the links that the
    // viewport hides included, so no role locator reaches them all.
    const addresses = await page
      .locator("a[href], link[href]")
      .evaluateAll((nodes) => nodes.map((node) => node.getAttribute("href")));
    expect(addresses.length).toBeGreaterThan(10);
    expect(addresses.filter((href) => /[?&]scheme=/.test(href ?? ""))).toEqual(
      [],
    );
    await follow(page, "Privacy", SITE_PATHS.privacy);
    await expectScheme(page, system);
    await expect(radio(page, system)).toBeChecked();
  },
);

test(
  "a kept choice is in force before the page body exists",
  DESKTOP,
  async ({ page }, info) => {
    const { other } = schemes(info);
    await page.goto(SITE_PATHS.terms);
    await segment(page, other).click();
    await expectScheme(page, other);
    // Record the root's scheme when the parser inserts the body, before any of
    // the page can paint. The init script runs before the page's own scripts.
    await page.addInitScript(() => {
      const record = window as Window & { schemeAtBody?: string };
      const observer = new MutationObserver(() => {
        if (!document.body) return;
        observer.disconnect();
        record.schemeAtBody = getComputedStyle(
          document.documentElement,
        ).colorScheme;
      });
      observer.observe(document, { childList: true, subtree: true });
    });
    await page.goto(SITE_PATHS.privacy);
    await expect
      .poll(() =>
        page.evaluate(
          () => (window as Window & { schemeAtBody?: string }).schemeAtBody,
        ),
      )
      .toBe(other);
  },
);

/** The focus glow, as the first shadow layer of a segment in the scheme. */
async function glowing(page: Page): Promise<RegExp> {
  const [glow = ""] = await focusGlows(page);
  return new RegExp(`^${glow.replace(/[()./]/g, "\\$&")}, `);
}

test(
  "the arrow keys choose between the options, and the focused segment draws the glow",
  DESKTOP,
  async ({ page }, info) => {
    const { other, system } = schemes(info);
    await page.goto(SITE_PATHS.terms);
    await page
      .getByRole("contentinfo")
      .getByRole("link", { name: "Mokly home" })
      .focus();
    await page.keyboard.press("Tab");
    await expect(radio(page, system)).toBeFocused();
    await expect(segment(page, system)).toHaveCSS(
      "box-shadow",
      await glowing(page),
    );
    await page.keyboard.press(system === "light" ? "ArrowRight" : "ArrowLeft");
    await expect(radio(page, other)).toBeFocused();
    await expect(radio(page, other)).toBeChecked();
    await expectScheme(page, other);
    await expect(segment(page, other)).toHaveCSS(
      "box-shadow",
      await glowing(page),
    );
    await expect(segment(page, system)).toHaveCSS("box-shadow", "none");
  },
);

test.describe("without script", DESKTOP, () => {
  test.use({ javaScriptEnabled: false });

  test("the scheme control does not show and the page follows the system scheme", async ({
    page,
  }, info) => {
    const { system } = schemes(info);
    await page.goto(SITE_PATHS.terms);
    await expect(page.getByRole("contentinfo")).toBeVisible();
    const hidden = page.getByRole("group", {
      includeHidden: true,
      name: "Color scheme",
    });
    await expect(hidden).toHaveCount(1);
    await expect(hidden).toBeHidden();
    await expectScheme(page, system);
  });
});
