import { tokens } from "@mokly-cloud/tokens/tokens";
import { type Locator, type Page, expect, test } from "@playwright/test";

import { openLargeText } from "./large-text.js";
import { openSearch } from "./search.js";

const PAGE = "/docs/start/your-first-screen/";

/** The code panel of the guide's HTML sample. */
function samplePanel(page: Page): Locator {
  return page.locator(".site-code", { hasText: "welcome.screen.html" });
}

/** A `#rrggbb` token colour as the browser computes it. */
function rgb(hex: string): string {
  const [red, green, blue] = [1, 3, 5].map((start) =>
    Number.parseInt(hex.slice(start, start + 2), 16),
  );
  return `rgb(${red}, ${green}, ${blue})`;
}

test("copying a multi-line shell block writes its lines without prompts", async ({
  context,
  page,
}) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto(PAGE);
  const panel = page.locator(".site-code", {
    hasText: "npx mokly build --out mokly-static",
  });
  const copy = panel.getByRole("button");
  await expect(copy).toHaveText("Copy");
  await copy.click();
  await expect(copy).toHaveText("Copied");
  await expect
    .poll(() => page.evaluate(() => navigator.clipboard.readText()))
    .toBe("npx mokly serve\nnpx mokly build --out mokly-static");
});

test("a code panel stays dark in both schemes", async ({ page }, testInfo) => {
  await page.goto(PAGE);
  const panel = page.locator(".site-code", {
    hasText: "npx mokly build --out mokly-static",
  });
  const fill =
    testInfo.project.use.colorScheme === "dark"
      ? tokens.color.dark.surfaceMuted
      : tokens.color.light.text;
  await expect(panel).toHaveCSS("background-color", rgb(fill));
});

test("Copy sits beside the sample's language at the end of its tab bar", async ({
  page,
}) => {
  await page.goto(PAGE);
  const panel = page.locator(".site-code", { hasText: "welcome.screen.html" });
  const language = panel.getByText("html", { exact: true });
  const copy = panel.getByRole("button");
  await expect(copy).toHaveText("Copy");
  // The bar's 4px gap is the only space between the language and Copy.
  await expect
    .poll(async () => {
      const [before, after] = await Promise.all([
        language.boundingBox(),
        copy.boundingBox(),
      ]);
      return before && after
        ? Math.round(after.x - (before.x + before.width))
        : undefined;
    })
    .toBe(4);
});

test("Copy and search start on a browser that never goes idle", async ({
  page,
}) => {
  // A page that stays busy gives the browser no idle period, and no user
  // action arranges that on demand. In this browser an idle callback runs
  // only when the deadline that its caller set has passed.
  await page.addInitScript(() => {
    let handles = 0;
    window.requestIdleCallback = (callback, options) => {
      if (options?.timeout === undefined) return (handles += 1);
      return window.setTimeout(
        () => callback({ didTimeout: true, timeRemaining: () => 0 }),
        options.timeout,
      );
    };
  });
  await page.goto(PAGE);
  const panel = page.locator(".site-code", {
    hasText: "npx mokly build --out mokly-static",
  });
  await expect(panel.getByRole("button")).toHaveText("Copy");
  await expect(await openSearch(page)).toBeVisible();
});

/**
 * Below about 348px the sample's tab bar cannot hold the file name, the
 * `html` label and Copy. The name shrinks and ends in an ellipsis, clear of
 * the label, and keeps the whole name as its text; at 390px it shows whole.
 */
for (const [width, cut] of [
  [320, true],
  [390, false],
] as const) {
  test(
    `at ${width}px the sample tab's file name ${cut ? "ends in an ellipsis" : "shows whole"} before the html label`,
    { tag: "@mobile" },
    async ({ page }) => {
      await page.setViewportSize({ height: 900, width });
      await page.goto(PAGE);
      const name = samplePanel(page).getByText("welcome.screen.html", {
        exact: true,
      });
      const language = samplePanel(page).getByText("html", { exact: true });
      await expect(name).toHaveText("welcome.screen.html");
      const [named, label] = await Promise.all([
        name.boundingBox(),
        language.boundingBox(),
      ]);
      if (!named || !label) throw new Error("the tab or its label has no box");
      expect(named.x + named.width).toBeLessThanOrEqual(label.x);
      const drawn = await name.evaluate((node) => ({
        clipped: getComputedStyle(node).overflowX === "hidden",
        ellipsis: getComputedStyle(node).textOverflow === "ellipsis",
        shortened: node.scrollWidth > node.clientWidth,
      }));
      expect(drawn).toEqual({ clipped: true, ellipsis: true, shortened: cut });
    },
  );
}

test(
  "at 200% text in a 320px window each line number of the sample keeps one line",
  { tag: "@mobile" },
  async ({ page }) => {
    await openLargeText(page, PAGE);
    // A line number is drawn by the stylesheet, so the check reads its box.
    const tall = await samplePanel(page)
      .locator(".site-code-line")
      .evaluateAll((lines) =>
        lines.flatMap((line) => {
          const number = Number.parseFloat(
            getComputedStyle(line, "::before").height,
          );
          const row = Number.parseFloat(getComputedStyle(line).lineHeight);
          return number > row + 0.5
            ? [`${line.dataset["line"]}: ${number}`]
            : [];
        }),
      );
    expect(tall).toEqual([]);
  },
);
