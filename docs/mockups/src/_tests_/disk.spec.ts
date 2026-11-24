import { existsSync, mkdirSync, readdirSync } from "node:fs";
import { dirname, relative, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { tokens } from "@mokly-cloud/tokens/tokens";
import { expect, test } from "@playwright/test";

import { currentDocumentPath } from "@mokly/viewer/data";

import { currentScreen } from "../fixtures/viewer-catalogue";

import { catalogueIndex } from "./catalogue-index";
import {
  catalogueRoot,
  outputRoot,
  repositoryFilePath,
  screenView,
} from "./catalogue-paths";
import type { Scheme, Viewport } from "./catalogue-paths";
import {
  controlDocumentViolations,
  controlPolicyInput,
} from "./controls-document-policy";
import { checkDiskOverlay } from "./disk-overlay-policy";
import { serveOutput } from "./disk-requests";
import { documentViolations } from "./document-policy";
import { focusPolicyViolations } from "./focus-policy";
import { inventoryPages } from "./product-inventory";
import { pendingSituationPaths } from "./product-situations";
import { settingsDocumentViolations } from "./settings-document-policy";

const screenshots = resolve(catalogueRoot, "../../.context/mockups-smoke");

/** One generated document: its output-relative file and the view it draws. */
interface GeneratedView {
  file: string;
  path: string;
  viewport: Viewport;
  scheme: Scheme;
}

/**
 * Every document that the catalogue index lists: both viewports of each color
 * scheme of every screen and component, the components' own pages included.
 */
const views: GeneratedView[] = [
  ...catalogueIndex().screens,
  ...catalogueIndex().components,
].flatMap(({ path, colorSchemes }) =>
  (["mobile", "desktop"] as const).flatMap((viewport) =>
    colorSchemes.map((scheme) => ({
      file: screenView(path, viewport, scheme),
      path,
      viewport,
      scheme,
    })),
  ),
);

/**
 * Every HTML file in the output's public tree, `static/`, which holds the
 * documents and each authored file that they reference, in sorted order.
 */
const files = readdirSync(resolve(outputRoot, repositoryFilePath("")), {
  recursive: true,
  encoding: "utf8",
})
  .filter((path) => path.endsWith(".html"))
  .map((path) => repositoryFilePath(path.split(sep).join("/")))
  .sort();

/** The one drawing that scrolls sideways: the home zoomed in to 200%. */
const sidewaysDrawing = "design/site/home/zoomed-in";

/** Product states whose controls are drawn disabled on purpose. */
const disabledStates = new Set(
  inventoryPages()
    .filter(({ state }) => state === "empty" || state === "loading")
    .map(({ path }) => path),
);

/**
 * Whether one entry draws a disabled control on purpose: a product screen's
 * empty or loading state, a write in flight, or a component's disabled
 * variant.
 */
function disabledByDesign(path: string): boolean {
  if (path.split("/")[0] === "design") return path.endsWith("/disabled");
  return disabledStates.has(path) || pendingSituationPaths.includes(path);
}

test("the complete generated catalogue is present", () => {
  const expected = views.map(({ file }) => file);
  expect(files).toEqual([...expected].sort());
  expect(new Set(expected).size).toBe(expected.length);
  expect(
    files.filter((file) =>
      file.startsWith(currentDocumentPath("product/settings/project/")),
    ),
  ).toEqual(
    [
      "product/settings/project",
      "product/settings/project/builds-saving",
      "product/settings/project/empty",
      "product/settings/project/error",
      "product/settings/project/loading",
      "product/settings/project/no-builds",
      "product/settings/project/scope-loading",
      "product/settings/project/visibility/plan",
      "product/settings/project/visibility/plan-admin",
      "product/settings/project/visibility/private",
      "product/settings/project/slug",
      "product/settings/project/slug/conflict",
      "product/settings/project/slug/empty",
      "product/settings/project/slug/error",
      "product/settings/project/slug/loading",
      "product/settings/project/visibility",
    ]
      .flatMap((id) =>
        (["mobile", "desktop"] as const).flatMap((viewport) =>
          (["light", "dark"] as const).map((scheme) =>
            screenView(id, viewport, scheme),
          ),
        ),
      )
      .sort(),
  );
  expect(
    files.filter((file) => !file.startsWith(currentDocumentPath(""))),
  ).toEqual([]);
  for (const retired of [
    "marketing/",
    "explore/",
    "product/workspace/",
    "product/review/",
    "user-flows/marketing/",
  ])
    expect(views.some(({ path }) => path.startsWith(retired))).toBe(false);

  for (const { path } of views)
    for (const viewport of ["mobile", "desktop"] as const)
      for (const scheme of ["light", "dark"] as const)
        expect(files, path).toContain(screenView(path, viewport, scheme));
});

for (const { file, path, viewport, scheme } of views) {
  test("disk: " + file, async ({ page }) => {
    const mobile = viewport === "mobile";
    await page.setViewportSize({
      width: mobile ? 390 : 1440,
      height: mobile ? 844 : 900,
    });
    const errors: string[] = [];
    await page.route("**/*", serveOutput);
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("requestfailed", (request) => {
      errors.push(request.url() + " " + (request.failure()?.errorText ?? ""));
    });
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });
    await page.goto(pathToFileURL(resolve(outputRoot, file)).href);
    await page.evaluate(async () => {
      await document.fonts.ready;
      await Promise.all([...document.images].map((image) => image.decode()));
    });
    expect(await page.evaluate(documentViolations)).toEqual([]);
    await checkDiskOverlay(page);
    if (path.startsWith("product/settings/"))
      expect(await page.evaluate(settingsDocumentViolations)).toEqual([]);
    expect(
      await page.evaluate(
        controlDocumentViolations,
        controlPolicyInput(disabledByDesign(path)),
      ),
    ).toEqual([]);
    // A primary action's label takes the on-accent colour of the tokens: the
    // Canvas signal fill carries its own white label in both schemes.
    const foreground = tokens.color[scheme].onAccent;
    const rgb = [1, 3, 5]
      .map((start) => Number.parseInt(foreground.slice(start, start + 2), 16))
      .join(", ");
    for (const button of await page.getByTestId("firna-button-primary").all()) {
      await expect(button.locator("[dir]").first()).toHaveCSS(
        "color",
        "rgb(" + rgb + ")",
      );
    }
    await expect(page.locator("main")).toBeVisible();
    expect(
      (await page.locator("main").innerText()).trim().length,
    ).toBeGreaterThan(5);
    // No page scrolls sideways, except the home zoomed in to 200%: it keeps
    // its layout of 100% at twice the size, so it is twice the page's width
    // without its scrollbar, which a classic scrollbar takes from the window.
    expect(
      await page.evaluate(
        () =>
          document.documentElement.scrollWidth /
          document.documentElement.clientWidth,
      ),
    ).toBe(path === sidewaysDrawing ? 2 : 1);
    const targets = await page
      .locator("a[href], link[href], img[src]")
      .evaluateAll((nodes) =>
        nodes.map((node) =>
          node instanceof HTMLImageElement
            ? node.src
            : (node as HTMLAnchorElement).href,
        ),
      );
    for (const target of targets)
      if (target.startsWith("file:")) {
        const url = new URL(target);
        expect(
          existsSync(fileURLToPath(url)),
          relative(outputRoot, fileURLToPath(url)),
        ).toBe(true);
        if (url.hash && url.pathname === new URL(page.url()).pathname) {
          expect(
            await page.evaluate(
              (id) => !!document.getElementById(id),
              decodeURIComponent(url.hash.slice(1)),
            ),
          ).toBe(true);
        }
      }
    // A viewer drawing's canvas frames each hold the sample screen and show
    // it: a frame for each view of the screen on a desktop, and on a phone
    // the compact layout's one frame, of the document's viewport.
    const drawings = await page.locator(".mokly-viewer").count();
    const sample = '[data-mkc-sample-screen="' + currentScreen.path + '"]';
    const shown = drawings * (mobile ? 1 : currentScreen.views.length);
    const frames = page.locator("[data-mokly-stage] [data-canvas-frame]");
    await expect(frames).toHaveCount(shown);
    await expect(frames.locator(sample).filter({ visible: true })).toHaveCount(
      shown,
    );
    if (mobile)
      await expect(
        frames.and(page.locator('[data-canvas-frame="mobile"]')),
      ).toHaveCount(shown);
    expect(errors).toEqual([]);
    const screenshot = resolve(screenshots, file + ".png");
    mkdirSync(dirname(screenshot), { recursive: true });
    await page.screenshot({
      path: screenshot,
      fullPage: true,
      animations: "disabled",
    });
    // Check focus outlines after the capture, so their focus rings stay out of it.
    expect(await focusPolicyViolations(page, scheme)).toEqual([]);
  });
}

test("rendered policy rejects invalid screen structure and state copy", async ({
  page,
}) => {
  for (const fixture of [
    "<main><h1>Fixture</h1>" +
      '<section data-mkc-screen="screen"></section>'.repeat(6) +
      "</main>",
    '<main data-child-pages><h1>Fixture</h1><a href="#">Child</a></main>',
    '<main data-mkc-screen="screen"><h1>Fixture</h1><p data-policy-note>Internal note</p></main>',
    '<main data-mkc-screen="screen"><h1>Fixture</h1><p>TODO: wire up real data</p></main>',
    '<main data-catalogue-index><h1>Fixture</h1><section data-mkc-screen="hidden"></section></main>',
    '<main data-mkc-screen="screen"><h1>Failed</h1><section class="fo-state fo-state-problem"><span class="fo-state-glyph">!</span><div class="fo-state-action">Retry</div><details><summary>Details</summary></details></section></main>',
    '<main data-mkc-screen="screen"><h1>Signing you in</h1><div class="fo-wait" aria-busy="true"><div class="fo-state fo-wait-state"><h2 class="fo-state-title fo-wait-title"><span class="fo-pending-label fo-wait-name">Signing you in…</span></h2></div></div></main>',
  ]) {
    await page.setContent(fixture);
    expect((await page.evaluate(documentViolations)).length).toBeGreaterThan(0);
  }
});

test("rendered policy accepts hidden state announcements", async ({ page }) => {
  await page.setContent(
    '<main data-mkc-screen="screen"><h1>Signing you in</h1><div class="fo-wait" aria-busy="true"><span class="fo-pending-label fo-sr-only" role="status">Signing you in…</span><div class="fo-state fo-wait-state"></div></div><section class="fo-state fo-state-problem"><span class="fo-sr-only">Sign-in failed</span></section></main>',
  );
  expect(await page.evaluate(documentViolations)).toEqual([]);
});
