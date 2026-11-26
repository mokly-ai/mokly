import { pathToFileURL } from "node:url";

import { expect, test } from "@playwright/test";
import type { Locator, Page } from "@playwright/test";

import { catalogueEntries } from "./catalogue-index";
import { screenFile, screenView } from "./catalogue-paths";
import { inventoryPages } from "./product-inventory";

/** Every product screen and variant, in its light mobile view. */
const screens = inventoryPages().map(({ path }) => path);

/** Plain links whose focus indication the responsive sweep checks. */
function plainLinks(page: Page): Locator {
  return page
    .getByRole("link")
    .and(page.locator("a[href]:not([data-mokly-link-control]):visible"));
}

test("the focus sweep reaches only active plain links", async ({ page }) => {
  await page.setContent(
    '<div inert aria-hidden="true"><a href="#main">Hidden skip link</a></div><main id="main"><a href="#main">Panel action</a></main>',
  );
  const links = plainLinks(page);
  await expect(links).toHaveCount(1);
  await expect(links).toHaveText("Panel action");
  await links.focus();
  await expect(links).toBeFocused();
});

test("the responsive sweep covers the whole product inventory", () => {
  expect([...screens].sort()).toEqual(
    catalogueEntries()
      .filter(
        (entry) => entry.kind === "screen" && entry.path.startsWith("product/"),
      )
      .map((entry) => entry.path)
      .sort(),
  );
  expect(new Set(screens).size).toBe(screens.length);
});

for (const id of screens) {
  test(
    "320px and enlarged text: " + screenView(id, "mobile"),
    async ({ page }) => {
      await page.setViewportSize({ width: 320, height: 844 });
      await page.goto(pathToFileURL(screenFile(id, "mobile")).href);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      await page.addStyleTag({ content: "html { font-size: 200%; }" });
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      await expect(page.locator(".review-brand, .mbk-brand")).toHaveCount(1);
      // Every page must reach the reader with something, and every active plain
      // link must show where focus is. Only an open panel is exempt from having
      // one: it is the whole document, and everything before it is the inert
      // backdrop, so it carries no skip link to be that link. A link of the
      // package's shell, inside its `.mbk` root, shows the focus glow of
      // decision 38: no outline and a box shadow, on the link or, for a
      // catalogue row, on its pill. The cloud's own links keep the solid
      // outline; a row that is a link as a whole draws it on the ::after box
      // that reaches the row's frame.
      const overlay = await page.locator(".fo-viewer-backdrop").count();
      const links = await plainLinks(page).all();
      if (overlay === 0) expect(links.length).toBeGreaterThan(0);
      else
        expect(
          await page.getByRole("link").or(page.getByRole("button")).count(),
        ).toBeGreaterThan(0);
      for (const link of links) {
        await link.focus();
        await expect(link).toBeFocused();
        const focus = await link.evaluate((node) => ({
          glow: [undefined, "::before", "::after"].some(
            (part) => getComputedStyle(node, part).boxShadow !== "none",
          ),
          outline:
            getComputedStyle(node).outlineStyle === "none"
              ? getComputedStyle(node, "::after").outlineStyle
              : getComputedStyle(node).outlineStyle,
          shell: node.closest(".mbk") !== null,
        }));
        if (focus.shell) {
          expect(focus.outline).toBe("none");
          expect(focus.glow).toBe(true);
        } else expect(focus.outline).toBe("solid");
      }
    },
  );
}

/** The account frame holds one identity in the header and the mark in the panel. */
const identities = [
  ["sign-up", null],
  ["magic-link", "a"],
  ["create-workspace", ".review-account"],
] as const;

/** The region's padding box, which its children must never cross. */
async function contentBounds(locator: Locator) {
  return locator.evaluate((node) => {
    const rect = node.getBoundingClientRect();
    const style = getComputedStyle(node);
    return {
      left: rect.left + Number.parseFloat(style.paddingLeft),
      right: rect.right - Number.parseFloat(style.paddingRight),
    };
  });
}

for (const scheme of ["light", "dark"] as const) {
  test(
    "the account frame keeps one header height and its gutters: " + scheme,
    async ({ page }) => {
      await page.setViewportSize({ width: 320, height: 844 });
      const heights: number[] = [];
      for (const [screen, identity] of identities) {
        await page.goto(
          pathToFileURL(
            screenFile("product/account/" + screen, "mobile", scheme),
          ).href,
        );
        const header = page.locator(".fo-account-header");
        const panel = page.locator(".fo-account-panel");
        await expect(header.locator(".review-brand")).toHaveCount(0);
        await expect(panel.locator(".review-brand")).toHaveCount(1);
        if (identity) await expect(header.locator(identity)).toBeVisible();
        await expect(header.locator(":scope > *")).toHaveCount(
          identity ? 1 : 0,
        );
        heights.push((await header.boundingBox())!.height);
        await page.addStyleTag({ content: "html { font-size: 200%; }" });
        const headerBounds = await contentBounds(header);
        const content = page.locator(".fo-account-content");
        const panelBounds = await contentBounds(content);
        for (const font of ["var(--mk-font-sans)", "sans-serif"]) {
          await page.addStyleTag({
            content: ".review-brand { font-family: " + font + "; }",
          });
          for (const [region, bounds] of [
            [header, headerBounds],
            [content, panelBounds],
          ] as const)
            for (const child of await region.locator(":scope > *").all()) {
              const box = await child.boundingBox();
              expect(box!.x).toBeGreaterThanOrEqual(bounds.left);
              expect(box!.x + box!.width).toBeLessThanOrEqual(bounds.right);
            }
        }
      }
      expect(heights[0]).toBe(heights[1]);
    },
  );
}
