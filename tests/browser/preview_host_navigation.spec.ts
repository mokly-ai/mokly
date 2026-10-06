import { expect } from "@playwright/test";

import { validEntrySource } from "../helpers/fixture.js";
import { FULL_CATALOGUE_SETUP_TIMEOUT_MS } from "../helpers/fixture_timing.js";
import { createPreviewComparisonFixture } from "../helpers/preview_comparison_fixture.js";

import { expectPresentedPane, PANE_SOURCE } from "./comparison_actions.js";
import { focusLink } from "./link_focus.js";
import { ordinaryPreviewTest } from "./ordinary_preview_fixture.js";
import { servePreviewFixture, type PreviewFixture } from "./preview_fixture.js";
import type { OwnedPreviewFixture } from "./preview_fixture_owner.js";
import {
  chooseScheme,
  chooseViewport,
  expectFrameSource,
} from "./workspace_actions.js";

const test = ordinaryPreviewTest("static-example");

let comparisonFixture: Awaited<
  ReturnType<typeof createPreviewComparisonFixture>
>;
let comparisonPreview: PreviewFixture;
let preview: OwnedPreviewFixture;
test.describe.configure({ timeout: 90_000 });

test.beforeAll(async ({ ordinaryPreview }) => {
  test.setTimeout(FULL_CATALOGUE_SETUP_TIMEOUT_MS);
  preview = ordinaryPreview;
  comparisonFixture = await createPreviewComparisonFixture(linkEntrySource);
  comparisonPreview = await servePreviewFixture(comparisonFixture.output);
});

test.afterAll(async () => {
  await comparisonPreview?.close();
  await comparisonFixture?.close();
});

test("published scheme swaps survive a redirected source replacement", async ({
  page,
}) => {
  await page.route(
    /\/static\/example\/screens\/welcome\/index\.desktop\.dark\.html$/,
    async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 100));
      await route.continue();
    },
  );
  await page.goto(`${preview.url}/view/example/screens/welcome/`);
  await chooseViewport(page, "both");
  await chooseScheme(page, "dark");
  for (const viewport of ["mobile", "desktop"] as const) {
    const frame = page.locator(`.mbk-frame-${viewport} iframe`);
    await expectFrameSource(
      frame,
      new RegExp(`welcome/index\\.${viewport}\\.dark$`),
    );
    await expect(frame).toHaveAttribute("data-mokly-frame-state", "ready");
  }
});

for (const viewport of ["mobile", "desktop"] as const) {
  test(`${viewport}: Pages navigation keeps Dark and Enter activates a link control`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1600, height: 1000 });
    await page.goto(`${preview.url}/view/example/screens/welcome/`);
    await chooseViewport(page, viewport);
    await expect(page.locator("html")).toHaveAttribute(
      "data-mokly-hydrated",
      "",
    );
    await chooseScheme(page, "dark");
    await expect(page.locator("html")).toHaveAttribute(
      "data-mokly-theme",
      "dark",
    );
    const iframe = page.locator(`.mbk-frame-${viewport} iframe`);
    await expectFrameSource(
      iframe,
      new RegExp(`welcome/index\\.${viewport}\\.dark$`),
    );
    await expect(iframe).toHaveAttribute("data-mokly-frame-state", "ready");
    const frame = iframe.contentFrame();
    await frame
      .getByRole("link", { name: "View details", exact: true })
      .click();
    await expect(page).toHaveURL(
      /\/view\/example\/screens\/details\/\?fragment=details$/,
    );
    await expect(
      page.locator('a[data-route="example/screens/details/index.html"]'),
    ).toHaveAttribute("aria-current", "page");
    await expectFrameSource(iframe, /\.dark(?:\.html)?#details$/);
    const back = frame
      .locator('a[data-mokly-link-control="button"]')
      .filter({ hasText: "Return to welcome" });
    await focusLink(back);
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/view\/example\/screens\/welcome\/$/);
    await expectFrameSource(
      iframe,
      new RegExp(`welcome/index\\.${viewport}\\.dark$`),
    );
  });

  test(`${viewport}: published comparison panes stay read-only`, async ({
    page,
  }) => {
    await page.goto(`${comparisonPreview.url}/view/home/`);
    await chooseViewport(page, viewport);
    await page
      .getByRole("button", { name: "Side by side", exact: true })
      .click();
    const iframe = page.locator("[data-diff-stage] iframe").last();
    await expectPresentedPane(iframe);
    const source = await iframe.getAttribute(PANE_SOURCE);
    const frame = iframe.contentFrame();
    const next = frame.getByRole("link", { name: "View details", exact: true });
    await expect(next).toHaveAttribute(
      "href",
      `../details/index.${viewport}.html#details`,
    );
    const address = page.url();
    const expectPresentation = async () => {
      await expect(page).toHaveURL(address);
      await expect(page.locator("#mb-main h2")).toHaveText("Home");
      await expect(frame.locator("h1")).toHaveText("Current home");
      await expect(iframe).toHaveAttribute(PANE_SOURCE, source!);
      expect(
        await iframe.evaluate(
          (element: HTMLIFrameElement) => element.contentDocument?.URL,
        ),
      ).toBe("about:srcdoc");
    };
    await next.click();
    await expectPresentation();
    await frame.getByRole("button", { name: "Send", exact: true }).click();
    await expectPresentation();

    const viewports = page.locator(
      "[data-diff-stage] [data-comparison-viewport]",
    );
    await expect(viewports).toHaveCount(2);
    await frame.getByRole("link", { name: "Jump to end", exact: true }).click();
    await expect
      .poll(() => viewports.last().evaluate((element) => element.scrollTop))
      .toBeGreaterThan(0);
    const shared = await viewports
      .last()
      .evaluate((element) => element.scrollTop);
    for (const pane of await page.locator("[data-diff-stage] iframe").all())
      await expect
        .poll(() =>
          pane
            .contentFrame()
            .locator("html")
            .evaluate((root) => root.ownerDocument.scrollingElement!.scrollTop),
        )
        .toBe(shared);
    expect(
      await viewports.first().evaluate((element) => element.scrollTop),
    ).toBe(shared);
    await expectPresentation();
  });
}

function linkEntrySource(changed: boolean): string {
  const source = validEntrySource({
    body: `<h1>${changed ? "Current" : "Previous"} home</h1><a href="mock:details#details">View details</a><a href="#home-end">Jump to end</a><form><input aria-label="Query" name="q" /><button type="submit">Send</button></form><div style={{ height: 2000 }}>Spacer</div><p id="home-end">End</p>`,
  });
  const details =
    '<main id="details"><h1>Details</h1><a href="mock:home">Return home</a></main>';
  return source
    .replace('<main id="details">Detail</main>', details)
    .replace('<main id="details-mobile">Detail</main>', details);
}
