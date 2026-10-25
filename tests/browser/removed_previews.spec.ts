import { expect, type Page, type Request } from "@playwright/test";

import { comparisonPaths, test } from "./comparison_test.js";
import {
  chooseFilter,
  comparisonIndex,
  navRow,
  snapshotOf,
  type ComparisonIndex,
} from "./comparison_ui.js";
import { endedRequests, passRenderingUpdates } from "./page_settling.js";
import { responseFailure } from "./shell_error_allowances.js";
import { chooseViewport } from "./workspace_actions.js";

const PREVIEW = "iframe[data-mokly-preview-frame]";
const SCREEN_PREVIEW = "[data-mokly-preview] .mbk-frame-desktop iframe";

/** Every navigation the page or a frame starts after this call. */
function documentRequests(page: Page): string[] {
  const requested: string[] = [];
  page.on("request", (request) => {
    if (request.isNavigationRequest()) requested.push(request.url());
  });
  return requested;
}

/** Open the removed page's previous version and wait for its body. */
async function openRetiredPage(page: Page, snapshot: string): Promise<void> {
  await page.goto(`/view/${comparisonPaths.removedPage}/?snapshot=${snapshot}`);
  await expect(
    page
      .frameLocator(PREVIEW)
      .getByRole("heading", { name: "Historical page" }),
  ).toBeVisible();
}

/** The site path of the removed page's previous document. */
function retiredPageDocument(index: ComparisonIndex): string {
  const generation = index.comparisonUrl.replace(/review\.json$/, "");
  return `/${generation}snapshots/before/mokly-generated/${comparisonPaths.removedPage}/index.html`;
}

test("a previous version reads but never acts", async ({
  page,
  request,
  baseURL,
  allowBrowserError,
}) => {
  // The sandbox reports the one form submission it blocks.
  allowBrowserError({
    kind: "console",
    message:
      /^Blocked form submission to 'https:\/\/example\.com\/form' because the form's frame is sandboxed and the 'allow-forms' permission is not set\.$/u,
    url: /^about:srcdoc$/u,
  });
  const snapshot = snapshotOf(
    await comparisonIndex(request, baseURL),
    comparisonPaths.removedPage,
  );
  await openRetiredPage(page, snapshot);
  const preview = page.frameLocator(PREVIEW);
  const address = page.url();
  const opened = await page
    .locator(PREVIEW)
    .getAttribute("data-mokly-preview-source");
  expect(opened).not.toBeNull();
  const documents = documentRequests(page);
  for (const label of [
    "Marked catalogue link",
    "External link",
    "Download link",
    "SVG link",
  ])
    await preview.getByText(label, { exact: true }).click();
  await preview.getByRole("button", { name: "Send" }).click();
  await preview.getByText("Marked catalogue link").focus();
  await page.keyboard.press("Enter");
  // A same-document anchor still moves the previous version to its target.
  await preview.getByText("Jump to the end").focus();
  await page.keyboard.press("Enter");
  await expect
    .poll(() =>
      preview.locator("#foot").evaluate((foot) => {
        const bounds = foot.getBoundingClientRect();
        return bounds.top < window.innerHeight && bounds.bottom > 0;
      }),
    )
    .toBe(true);
  expect(documents).toEqual([]);
  expect(page.url()).toBe(address);
  await expect(page.locator(PREVIEW)).toHaveAttribute(
    "data-mokly-preview-source",
    opened!,
  );
  await expect(page.locator("#mb-main h2").first()).toHaveText("Retired page");
});

test("Space scrolls a previous version while a link holds focus", async ({
  page,
  request,
  baseURL,
}) => {
  const snapshot = snapshotOf(
    await comparisonIndex(request, baseURL),
    comparisonPaths.removedPage,
  );
  await openRetiredPage(page, snapshot);
  const preview = page.frameLocator(PREVIEW);
  const address = page.url();
  const documents = documentRequests(page);
  const offset = () =>
    preview
      .locator("html")
      .evaluate((root) => root.ownerDocument.scrollingElement!.scrollTop);
  await preview.getByText("Marked catalogue link").focus();
  await page.keyboard.press("Space");
  await expect.poll(offset).toBeGreaterThan(0);
  await preview.getByText("Marked catalogue link").focus();
  await page.keyboard.press("Enter");
  expect(documents).toEqual([]);
  expect(page.url()).toBe(address);
});

test("browsing current entries requests no historical bytes", async ({
  page,
}) => {
  const requests: string[] = [];
  page.on("request", (request) => requests.push(request.url()));
  await page.goto(`/view/${comparisonPaths.changed}/`);
  await expect(page.locator("[data-workspace-status]")).toHaveText("Changed");
  await chooseFilter(page, "changed");
  await chooseFilter(page, "all");
  await chooseViewport(page, "mobile");
  await expect(
    page
      .frameLocator('iframe[data-workspace-frame="mobile"]')
      .getByRole("heading", { name: "After screen" }),
  ).toBeVisible();
  await navRow(page, comparisonPaths.component).click();
  await expect(page.locator("#mb-main h2").first()).toHaveText("Card");
  expect(
    requests.filter((url) => url.includes("/mokly-viewer/diffs/")),
  ).toEqual([]);
});

test("a later frame navigation restores the accepted presentation", async ({
  page,
  request,
  baseURL,
}) => {
  const snapshot = snapshotOf(
    await comparisonIndex(request, baseURL),
    comparisonPaths.removedPage,
  );
  await openRetiredPage(page, snapshot);
  const frame = page.locator(PREVIEW);
  const source = await frame.getAttribute("data-mokly-preview-source");
  expect(source).not.toBeNull();
  const away = "/static/mokly-generated/screens/stable/index.desktop.html";
  const navigated = page.waitForEvent("framenavigated", (target) =>
    target.url().endsWith(away),
  );
  await frame.evaluate((element: HTMLIFrameElement, url) => {
    if (element.contentWindow) element.contentWindow.location.href = url;
  }, away);
  await navigated;
  await expect
    .poll(() =>
      frame.evaluate(
        (element: HTMLIFrameElement) => element.contentDocument?.URL,
      ),
    )
    .toBe("about:srcdoc");
  await expect(
    page
      .frameLocator(PREVIEW)
      .getByRole("heading", { name: "Historical page" }),
  ).toBeVisible();
  await expect(frame).toHaveAttribute("data-mokly-preview-source", source!);
  await expect(frame).not.toHaveAttribute("src", /.+/);
});

test("a preview that cannot be loaded offers another attempt", async ({
  page,
  request,
  baseURL,
  allowBrowserError,
}) => {
  const index = await comparisonIndex(request, baseURL);
  const snapshot = snapshotOf(index, comparisonPaths.removedPage);
  const document = retiredPageDocument(index);
  allowBrowserError(responseFailure(baseURL!, document, 503));
  let fail = true;
  await page.route(`**${document}`, (route) =>
    fail ? route.fulfill({ status: 503, body: "" }) : route.continue(),
  );
  await page.goto(`/view/${comparisonPaths.removedPage}/?snapshot=${snapshot}`);
  await expect(
    page.getByRole("heading", { name: "Previous version unavailable" }),
  ).toBeVisible();
  const retry = page.locator("[data-mokly-preview-retry]");
  await expect(retry).toHaveText("Retry");
  await chooseFilter(page, "changed");
  await expect(navRow(page, comparisonPaths.removedScreen)).toBeVisible();
  fail = false;
  await retry.click();
  await expect(
    page
      .frameLocator(PREVIEW)
      .getByRole("heading", { name: "Historical page" }),
  ).toBeVisible();
});

test("navigation fences a late response and keeps history usable", async ({
  page,
  request,
  baseURL,
}) => {
  const document = retiredPageDocument(await comparisonIndex(request, baseURL));
  let release = (): void => undefined;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  const heldRequests: Request[] = [];
  await page.route(`**${document}`, async (route) => {
    heldRequests.push(route.request());
    await held;
    await route.continue().catch(() => undefined);
  });
  const ended = endedRequests(page);
  await page.goto(`/view/${comparisonPaths.changed}/`);
  await chooseFilter(page, "changed");
  await navRow(page, comparisonPaths.removedPage).click();
  await expect(page.locator(".mbk-preview-status")).toHaveText(
    "Loading previous version…",
  );
  // Move on only once the shell holds a request for the page document.
  await expect.poll(() => heldRequests.length).toBeGreaterThan(0);
  await navRow(page, comparisonPaths.removedScreen).click();
  const screen = page
    .frameLocator(SCREEN_PREVIEW)
    .getByRole("heading", { name: "Historical screen" });
  await expect(screen).toBeVisible();
  // Release the held document, wait until the browser ends that request
  // (the shell cancels it when the reader moves on), then let the shell
  // handle the outcome.
  release();
  await expect
    .poll(() => heldRequests.every((held) => ended.has(held)))
    .toBe(true);
  await passRenderingUpdates(page);
  await expect(page.locator(".mbk-preview-status")).toHaveCount(0);
  await expect(screen).toBeVisible();
  await page.goBack();
  await expect(
    page
      .frameLocator(PREVIEW)
      .getByRole("heading", { name: "Historical page" }),
  ).toBeVisible();
  await page.goForward();
  await expect(screen).toBeVisible();
});
