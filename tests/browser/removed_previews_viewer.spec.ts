/**
 * Previous versions in an embedded viewer over the copied comparison output,
 * under the removed previews and frame adapter contracts. Through both frame
 * adapters, a removed page and a removed screen show their previous versions
 * and stay inert, and their frames send no message. A cross-origin
 * navigation of a preview frame restores the presentation, a strict host
 * Content Security Policy still loads the historical stylesheet, a selection
 * change fences the previous request, and two viewers keep their own stages.
 */

import { expect, type Page, type Request } from "@playwright/test";

import { comparisonPaths, test } from "./comparison_test.js";
import {
  awaitRoutedDetail,
  comparisonIndex,
  navRow,
  snapshotOf,
} from "./comparison_ui.js";
import {
  comparisonViewerHost,
  type ComparisonViewerHost,
} from "./comparison_viewer_host.js";
import { endedRequests, passRenderingUpdates } from "./page_settling.js";
import { blockedFormSubmission } from "./shell_error_allowances.js";

const STAGE = "#viewer [data-mokly-preview]";

let host: ComparisonViewerHost;
test.beforeAll(async () => {
  host = await comparisonViewerHost();
});
test.afterAll(async () => {
  await host?.close();
});

/** The host page with one removed entry selected under the Changes filter. */
function viewerAt(
  adapter: "cross" | "same-origin",
  entry: string = comparisonPaths.removedPage,
  origin = host.url,
): string {
  return `${origin}/viewer.html?adapter=${adapter}&view=changes&entry=${entry}`;
}

/** One probe that the host page records. */
function probe(
  page: Page,
  name: "frameMessages" | "viewerNavigations",
): Promise<unknown[]> {
  return page.evaluate(
    (key) => (window as unknown as Record<string, unknown[]>)[key]!,
    name,
  );
}

/** Every navigation that the page or a frame starts after this call. */
function documentRequests(page: Page): string[] {
  const requested: string[] = [];
  page.on("request", (request) => {
    if (request.isNavigationRequest()) requested.push(request.url());
  });
  return requested;
}

const historicalPage = (page: Page) =>
  page.frameLocator(`${STAGE} iframe`).locator("h1");
const historicalScreen = (page: Page) =>
  page.frameLocator(`${STAGE} .mbk-frame-desktop iframe`).locator("h1");

for (const adapter of ["same-origin", "cross"] as const) {
  test(`an embedded viewer shows previous versions through the ${adapter} adapter`, async ({
    page,
    request,
    baseURL,
  }) => {
    const index = await comparisonIndex(request, baseURL);
    const requests: string[] = [];
    page.on("request", (sent) => requests.push(sent.url()));
    await page.goto(viewerAt(adapter));
    await expect(page.locator("#viewer .mbk-previous")).toHaveText(
      "Showing previous version",
    );
    await expect(historicalPage(page)).toHaveText("Historical page");
    await navRow(page, comparisonPaths.removedScreen).click();
    await expect(historicalScreen(page)).toHaveText("Historical screen");
    await awaitRoutedDetail(
      page.locator("#viewer"),
      comparisonPaths.removedScreen,
    );
    await expect(page.locator("#viewer .mbk-diff-toolbar")).toHaveCount(0);
    // No review read carries a query: each reads the pinned generation's file.
    expect(
      requests.filter(
        (url) => url.includes("review.json") && new URL(url).search !== "",
      ),
    ).toEqual([]);
    expect(await probe(page, "frameMessages")).toEqual([]);
    // The committed selection announces itself exactly once, also after the
    // next rendering updates.
    await passRenderingUpdates(page);
    expect(await probe(page, "viewerNavigations")).toEqual([
      {
        screenPath: comparisonPaths.removedScreen,
        snapshotId: snapshotOf(index, comparisonPaths.removedScreen),
      },
    ]);
  });

  test(`a previous version stays inert through the ${adapter} adapter`, async ({
    page,
    allowBrowserError,
  }) => {
    allowBrowserError(blockedFormSubmission);
    await page.goto(viewerAt(adapter));
    const preview = page.frameLocator(`${STAGE} iframe`);
    await expect(preview.locator("h1")).toHaveText("Historical page");
    const address = page.url();
    const documents = documentRequests(page);
    for (const label of [
      "Marked catalogue link",
      "External link",
      "Download link",
      "SVG link",
    ]) {
      await preview.getByText(label, { exact: true }).click();
      await expect(preview.locator("h1")).toHaveText("Historical page");
    }
    await preview.getByRole("button", { name: "Send" }).click();
    await preview.getByText("Marked catalogue link", { exact: true }).focus();
    await page.keyboard.press("Enter");
    await expect(preview.locator("h1")).toHaveText("Historical page");
    expect(documents).toEqual([]);
    expect(page.url()).toBe(address);
    expect(await probe(page, "frameMessages")).toEqual([]);
  });
}

test("a cross-origin frame navigation restores the presentation", async ({
  page,
}) => {
  await page.goto(viewerAt("cross"));
  const frame = page.locator(`${STAGE} iframe`);
  await expect(historicalPage(page)).toHaveText("Historical page");
  const source = await frame.getAttribute("data-mokly-preview-source");
  expect(source).not.toBeNull();
  const away = `${host.frameOrigin}/static/mokly-generated/${comparisonPaths.unchanged}/index.desktop.html`;
  const navigated = page.waitForEvent("framenavigated", (target) =>
    target.url().startsWith(away),
  );
  await frame.evaluate((element: HTMLIFrameElement, destination) => {
    element.contentWindow!.location.href = destination;
  }, away);
  await navigated;
  await expect
    .poll(() =>
      frame.evaluate(
        (element: HTMLIFrameElement) => element.contentDocument?.URL,
      ),
    )
    .toBe("about:srcdoc");
  await expect(historicalPage(page)).toHaveText("Historical page");
  await expect(frame).toHaveAttribute("data-mokly-preview-source", source!);
});

test("an embedded host CSP permits historical resources", async ({ page }) => {
  await page.addInitScript(() => {
    const violations: string[] = [];
    Object.assign(window, { cspViolations: violations });
    document.addEventListener("securitypolicyviolation", (event) =>
      violations.push(`${event.effectiveDirective}:${event.blockedURI}`),
    );
  });
  await page.goto(
    viewerAt("cross", comparisonPaths.removedLightOnly, host.cspUrl),
  );
  const screen = page.frameLocator(`${STAGE} .mbk-frame-desktop iframe`);
  await expect(screen.locator("h1")).toHaveText("Former screen");
  // The Before theme stylesheet colours the card that the screen used.
  await expect(screen.locator(".accent")).toHaveCSS(
    "color",
    "rgb(180, 30, 30)",
  );
  const violations = await Promise.all(
    page
      .frames()
      .map((frame) =>
        frame.evaluate(
          () =>
            (window as unknown as { cspViolations?: string[] }).cspViolations ??
            [],
        ),
      ),
  );
  expect(violations.flat()).toEqual([]);
});

test("a viewer selection change fences the previous request", async ({
  page,
}) => {
  let release = (): void => undefined;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  const heldRequests: Request[] = [];
  await page.route(
    `**/previews/${comparisonPaths.removedPage}/index.json`,
    async (route) => {
      heldRequests.push(route.request());
      await held;
      await route.continue().catch(() => undefined);
    },
  );
  const ended = endedRequests(page);
  await page.goto(viewerAt("same-origin"));
  await expect(page.locator("#viewer .mbk-preview-status")).toHaveText(
    "Loading previous version…",
  );
  await expect.poll(() => heldRequests.length).toBe(1);
  await navRow(page, comparisonPaths.removedScreen).click();
  await expect(historicalScreen(page)).toHaveText("Historical screen");
  release();
  await expect.poll(() => ended.has(heldRequests[0]!)).toBe(true);
  await passRenderingUpdates(page);
  await expect(historicalScreen(page)).toHaveText("Historical screen");
  await expect(page.locator("#viewer .mbk-preview-status")).toHaveCount(0);
});

test("several viewers on one page keep their own stages", async ({ page }) => {
  await page.goto(viewerAt("same-origin"));
  await expect(historicalPage(page)).toHaveText("Historical page");
  await page.evaluate((source) => {
    const frame = document.createElement("iframe");
    frame.id = "second";
    frame.style.cssText = "width:1200px;height:900px;border:0";
    frame.src = source;
    document.body.append(frame);
  }, `/viewer.html?adapter=same-origin&view=changes&entry=${comparisonPaths.removedScreen}`);
  const second = page.frameLocator("#second");
  await expect(second.locator("#viewer .mbk-previous")).toHaveText(
    "Showing previous version",
  );
  await expect(
    second.frameLocator(`${STAGE} .mbk-frame-desktop iframe`).locator("h1"),
  ).toHaveText("Historical screen");
  await expect(historicalPage(page)).toHaveText("Historical page");
});
