import { expect, type Page } from "@playwright/test";

import {
  appearance,
  expectCanvasFrames,
  screen,
  select,
  store,
} from "./appearance_assertions.js";
import { test } from "./browser_test.js";
import { canvasFrame, NARROW_WINDOW } from "./workspace_actions.js";

test("a saved appearance outranks the system and the pin outranks it", async ({
  page,
}) => {
  await store(page, "light");
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto(screen);
  await expect
    .poll(() => appearance(page))
    .toEqual({
      scheme: "light",
      theme: "light",
      value: "light",
    });

  await page.goto(`${screen}?scheme=dark`);
  await expect
    .poll(() => appearance(page))
    .toEqual({
      scheme: "dark",
      theme: "dark",
      value: "dark",
    });
  // The pin dressed this document; the saved preference is still the reader's.
  expect(await page.evaluate(() => localStorage.getItem("mokly:theme"))).toBe(
    "light",
  );
});

test("Auto follows the system while the document stays open", async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto(screen);
  await expect
    .poll(() => appearance(page))
    .toEqual({
      scheme: "light",
      theme: "auto",
      value: "auto",
    });

  await page.emulateMedia({ colorScheme: "dark" });
  await expect
    .poll(() => appearance(page))
    .toEqual({
      scheme: "dark",
      theme: "auto",
      value: "auto",
    });
  await expectCanvasFrames(page, "example/screens/welcome", true);

  // An explicit choice is the reader's, so the system no longer moves it.
  await page.locator(select).selectOption("light");
  await page.emulateMedia({ colorScheme: "dark" });
  await expect
    .poll(() => appearance(page))
    .toEqual({
      scheme: "light",
      theme: "light",
      value: "light",
    });
});

test("Auto keeps following the system after a back-forward cache restore", async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto(screen);
  await expect
    .poll(() => appearance(page))
    .toEqual({ scheme: "light", theme: "auto", value: "auto" });

  await page.evaluate(() => {
    window.dispatchEvent(
      new PageTransitionEvent("pagehide", { persisted: true }),
    );
    window.dispatchEvent(
      new PageTransitionEvent("pageshow", { persisted: true }),
    );
  });
  await page.emulateMedia({ colorScheme: "dark" });

  await expect
    .poll(() => appearance(page))
    .toEqual({ scheme: "dark", theme: "auto", value: "auto" });
  await expectCanvasFrames(page, "example/screens/welcome", true);
});

/**
 * Restore a saved Dark appearance and count each frame's document loads: a
 * canvas frame loads its own scheme's document once, in both layouts, and
 * the compact layout shows the dark frame at once.
 */
async function restoredDark(page: Page, canvas: boolean): Promise<void> {
  await store(page, "dark");
  const requests: string[] = [];
  page.on("request", (request) => {
    const url = new URL(request.url());
    // Only the frame documents; the shell's own view fetches are not swaps.
    if (
      /^\/static\/mokly-generated\/example\/screens\/welcome\/index\.(mobile|desktop)/u.test(
        url.pathname,
      )
    )
      requests.push(url.pathname);
  });
  await page.goto(screen);
  await expectCanvasFrames(page, "example/screens/welcome", true);
  if (!canvas)
    await expect(
      page.locator(
        `.mbk-canvas-cell:not([hidden]) ${canvasFrame("mobile", "dark")}`,
      ),
    ).toBeVisible();
  await page.locator("iframe").evaluateAll((frames) =>
    Promise.all(
      frames.map((frame) => {
        const document = (frame as HTMLIFrameElement).contentDocument;
        return document?.readyState === "complete"
          ? Promise.resolve()
          : new Promise((resolve) =>
              frame.addEventListener("load", resolve, { once: true }),
            );
      }),
    ),
  );

  for (const viewport of ["mobile", "desktop"]) {
    const dark = requests.filter((path) =>
      path.endsWith(`example/screens/welcome/index.${viewport}.dark.html`),
    );
    expect(dark, `${viewport} settled on one dark fragment`).toHaveLength(1);
    const light = requests.filter((path) =>
      path.endsWith(`example/screens/welcome/index.${viewport}.html`),
    );
    expect(light, `${viewport} loaded its Light frame once`).toHaveLength(1);
  }
}

for (const canvas of [true, false])
  test(
    canvas
      ? "on the canvas, a restored dark appearance loads each frame's document once"
      : "below the layout breakpoint, a restored dark appearance shows the dark frame and loads each frame's document once",
    async ({ page }) => {
      if (!canvas) await page.setViewportSize(NARROW_WINDOW);
      await restoredDark(page, canvas);
    },
  );

test("an appearance survives progressive navigation", async ({ page }) => {
  await page.goto(screen);
  await page.locator(select).selectOption("dark");
  await expect
    .poll(() => appearance(page))
    .toEqual({
      scheme: "dark",
      theme: "dark",
      value: "dark",
    });
  await page.evaluate(() => {
    (window as { __moklyDocument?: boolean }).__moklyDocument = true;
  });

  await page.click(
    'a[data-nav-row][data-route="example/screens/details/index.html"]',
  );
  await expect(page).toHaveURL(/example\/screens\/details\/$/u);
  expect(
    await page.evaluate(
      () => (window as { __moklyDocument?: boolean }).__moklyDocument === true,
    ),
    "the shell reloaded instead of navigating in place",
  ).toBe(true);
  await expect
    .poll(() => appearance(page))
    .toEqual({
      scheme: "dark",
      theme: "dark",
      value: "dark",
    });
});
