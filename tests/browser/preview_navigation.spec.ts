import { expect, type Page } from "@playwright/test";

import { test } from "./ordinary_preview_fixture.js";
import type { OwnedPreviewFixture } from "./preview_fixture_owner.js";
import { chooseScheme } from "./workspace_actions.js";

let preview: OwnedPreviewFixture;

test.describe.configure({ timeout: 90_000 });

test.beforeAll(async ({ ordinaryPreview }) => {
  test.setTimeout(90_000);
  preview = ordinaryPreview;
});

test("ordinary preview output is fresh and shared across worker consumers", async ({
  ordinaryPreview,
}) => {
  expect(ordinaryPreview).toBe(preview);
  expect(ordinaryPreview.freshness.outputWasAbsent).toBe(true);
  expect(ordinaryPreview.freshness.markerModifiedAtMs).toBeGreaterThanOrEqual(
    ordinaryPreview.freshness.preparationStartedAtMs - 2_000,
  );
  expect((await fetch(ordinaryPreview.url)).ok).toBe(true);
});

for (const width of [390, 1280]) {
  test(`ordinary publication omits review and live updates at ${width}px`, async ({
    page,
  }) => {
    const requests: string[] = [];
    page.on("request", (request) => requests.push(request.url()));
    await page.addInitScript(() => {
      window.EventSource = class {
        constructor() {
          throw new Error("static catalogue opened EventSource");
        }
      } as unknown as typeof EventSource;
      sessionStorage.setItem(
        "mokly:recovery",
        JSON.stringify({ changedOnly: true, mode: "overlay" }),
      );
    });
    await page.setViewportSize({ width, height: 900 });
    await page.goto(
      `${preview.url}/view/handbook?fragment=next-steps&filter=changed&mode=overlay`,
    );
    await expect(page.locator("#mb-main h2")).toHaveText("Getting started");
    await expect(page.locator("[data-filter], [data-diff-screen]")).toHaveCount(
      0,
    );
    await expect(page.locator(".mbk-stage-embed iframe")).toHaveAttribute(
      "src",
      /#next-steps$/,
    );
    await page.reload();
    await expect(page.locator(".mbk-stage-embed iframe")).toHaveAttribute(
      "src",
      /#next-steps$/,
    );
    await page
      .frameLocator(".mbk-stage-embed iframe")
      .getByRole("link", { name: "Open Welcome" })
      .click();
    await expect(page.locator("#mb-main h2")).toHaveText("Welcome");
    await page.goBack();
    await expect(page.locator("#mb-main h2")).toHaveText("Getting started");
    expect(
      requests.filter((url) => /__mokly\/(?:diffs|events)/.test(url)),
    ).toEqual([]);
  });
}

test("static catalogue navigation retains pointer and keyboard resizing", async ({
  page,
}) => {
  await page.setViewportSize({ height: 900, width: 1_280 });
  await page.goto(`${preview.url}/view/screens/welcome`);
  const nav = page.locator(".mbk-nav");
  const handle = page.getByRole("separator", {
    name: "Resize navigation panel",
  });
  await expect(handle).toBeVisible();
  const grip = await handle.boundingBox();
  if (!grip) throw new Error("static navigation resize bounds unavailable");
  await page.mouse.move(grip.x + grip.width / 2, grip.y + 100);
  await page.mouse.down();
  await page.mouse.move(grip.x + grip.width / 2 + 64, grip.y + 100);
  await page.mouse.up();
  await expect
    .poll(async () => (await nav.boundingBox())?.width)
    .toBeCloseTo(312, 0);
  await handle.focus();
  await page.keyboard.press("ArrowLeft");
  await expect
    .poll(async () => (await nav.boundingBox())?.width)
    .toBeCloseTo(296, 0);
  await page.reload();
  await expect
    .poll(async () => (await nav.boundingBox())?.width)
    .toBeCloseTo(296, 0);
});

test("direct screen fragments update current and swap sources", async ({
  page,
}) => {
  await page.goto(`${preview.url}/view/screens/details?fragment=details`);
  await expectAllSources(page, "#details");
  await chooseDark(page);
  await expectAllSources(page, "#details");

  await page.goto(`${preview.url}/view/screens/details?fragment=absent-anchor`);
  await expectAllSources(page, "#absent-anchor");
  await expectFrameAtTop(page);
  await chooseDark(page);
  await expectAllSources(page, "#absent-anchor");
  await expectFrameAtTop(page);
});

test("invalid and duplicate direct fragments leave every source unchanged", async ({
  page,
}) => {
  for (const query of [
    "fragment=%23details",
    "fragment=details&fragment=other",
  ]) {
    await page.goto(`${preview.url}/view/screens/details?${query}`);
    for (const source of await frameSources(page)) {
      expect(source.src).not.toContain("#");
      expect(source.light).not.toContain("#");
      expect(source.dark).not.toContain("#");
    }
  }
});

test("use-case fragments apply to the first step only", async ({ page }) => {
  await page.goto(
    `${preview.url}/view/user-flows/example-tour?fragment=welcome`,
  );
  const sources = await frameSources(page, ".mbk-flow-screen iframe");
  expect(sources).toHaveLength(2);
  expect(Object.values(sources[0] ?? {})).toEqual([
    expect.stringContaining("#welcome"),
    expect.stringContaining("#welcome"),
    expect.stringContaining("#welcome"),
  ]);
  expect(Object.values(sources[1] ?? {})).toEqual([
    expect.not.stringContaining("#"),
    expect.not.stringContaining("#"),
    expect.not.stringContaining("#"),
  ]);
  await chooseDark(page);
  const darkSources = await frameSources(page, ".mbk-flow-screen iframe");
  expect(darkSources[0]?.src).toContain("#welcome");
  expect(darkSources[1]?.src).not.toContain("#");
});

test("a static logical link retains its fragment through navigation and swaps", async ({
  page,
}) => {
  await page.goto(`${preview.url}/view/screens/welcome`);
  await page
    .frameLocator(".mbk-frame-mobile iframe")
    .getByRole("link", { name: "Open the details screen" })
    .click();
  await expect(page).toHaveURL(/\/view\/screens\/details\?fragment=details$/);
  await expect(page.locator("#mb-main h2")).toHaveText("Details");
  await expectAllSources(page, "#details");
  await chooseDark(page);
  await expectAllSources(page, "#details");
});

test("JavaScript-disabled static preview stays at its portable top", async ({
  browser,
}) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto(`${preview.url}/view/screens/details?fragment=details`);
  await expect(page.locator("[data-mokly-nav-resize]")).toBeHidden();
  for (const source of await frameSources(page)) {
    expect(source.src).not.toContain("#");
    expect(source.light).not.toContain("#");
    expect(source.dark).not.toContain("#");
  }
  await expectFrameAtTop(page);
  await context.close();
});

async function chooseDark(page: Page): Promise<void> {
  await chooseScheme(page, "dark");
}

async function expectAllSources(page: Page, suffix: string): Promise<void> {
  await expect
    .poll(() => frameSources(page))
    .toEqual([
      {
        dark: expect.stringContaining(suffix),
        light: expect.stringContaining(suffix),
        src: expect.stringContaining(suffix),
      },
      {
        dark: expect.stringContaining(suffix),
        light: expect.stringContaining(suffix),
        src: expect.stringContaining(suffix),
      },
    ]);
}

async function expectFrameAtTop(page: Page): Promise<void> {
  await expect
    .poll(() =>
      page
        .frameLocator(".mbk-frame-mobile iframe")
        .locator("html")
        .evaluate(() => window.scrollY),
    )
    .toBe(0);
}

function frameSources(
  page: Page,
  selector = "iframe[data-mokly-fragment-frame]",
): Promise<Array<{ dark: string; light: string; src: string }>> {
  return page.locator(selector).evaluateAll((frames) =>
    frames.map((frame) => ({
      dark: frame.getAttribute("data-fragment-dark") ?? "",
      light: frame.getAttribute("data-fragment-light") ?? "",
      src: frame.getAttribute("src") ?? "",
    })),
  );
}
