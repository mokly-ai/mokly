import { expect, type Page } from "@playwright/test";

import { comparisonPaths, test } from "./comparison_test.js";
import {
  chooseFilter,
  comparisonIndex,
  navRow,
  snapshotOf,
} from "./comparison_ui.js";
import { chooseViewport } from "./workspace_actions.js";

const PREVIEW = "iframe[data-mokly-preview-frame]";
const DOCUMENT_ICON = '.mbk-nav-ico path[d="M9 13h6M9 17h4"]';

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

test("a removed document is a Changes-only row with the document icon", async ({
  page,
}) => {
  await page.goto(`/view/${comparisonPaths.changed}/`);
  const removed = navRow(page, comparisonPaths.removedDocument);
  await expect(removed).toBeHidden();
  await page.fill("[data-mokly-search]", "retired");
  await expect(removed).toBeHidden();
  await page.fill("[data-mokly-search]", "");
  await chooseFilter(page, "changed");
  await expect(removed).toBeVisible();
  await expect(removed).toHaveAttribute("data-entry-kind", "document");
  await expect(removed).toHaveAccessibleName(/^Retired document · Removed/u);
  await expect(removed.locator(DOCUMENT_ICON)).toHaveCount(1);
  await page.fill("[data-mokly-search]", "retired");
  await expect(removed).toBeVisible();
});

for (const [kind, removedPath, title, content] of [
  [
    "screen",
    comparisonPaths.removedScreen,
    "Retired screen",
    "Historical screen",
  ],
  ["page", comparisonPaths.removedPage, "Retired page", "Historical page"],
] as const)
  test(`${kind} keeps its historical identity through Back, Forward and refresh`, async ({
    page,
    request,
    baseURL,
  }) => {
    const snapshot = snapshotOf(
      await comparisonIndex(request, baseURL),
      removedPath,
    );
    const previous = new RegExp(
      `/view/${removedPath}/\\?snapshot=${snapshot}$`,
    );
    const current = new RegExp(`/view/${comparisonPaths.changed}/$`);
    const frame =
      kind === "screen"
        ? "[data-mokly-preview] .mbk-frame-desktop iframe"
        : PREVIEW;
    const expectHistorical = async () => {
      await expect(page.locator("#mb-main h2").first()).toHaveText(title);
      await expect(page.locator(".mbk-previous")).toHaveText(
        "Showing previous version",
      );
      await expect(
        page.frameLocator(frame).getByRole("heading", { name: content }),
      ).toBeVisible();
    };
    const expectCurrent = async () => {
      await expect(page.locator("#mb-main h2").first()).toHaveText(
        "Changed screen",
      );
      await expect(page.locator("[data-mokly-preview]")).toHaveCount(0);
    };
    await page.goto(`/view/${comparisonPaths.changed}/`);
    await chooseFilter(page, "changed");
    await navRow(page, removedPath).click();
    await expect(page).toHaveURL(previous);
    await expectHistorical();
    await navRow(page, comparisonPaths.changed).click();
    await expect(page).toHaveURL(current);
    await expectCurrent();

    await page.goBack();
    await expect(page).toHaveURL(previous);
    await expectHistorical();
    await page.goForward();
    await expect(page).toHaveURL(current);
    await expectCurrent();
    await page.goBack();
    await page.reload();
    await expect(page).toHaveURL(previous);
    await expectHistorical();
  });

for (const changed of [false, true])
  test(`removed component variants keep eligible comparisons from ${changed ? "a changed" : "an unchanged"} parent`, async ({
    page,
  }) => {
    const [parent, variant, title] = changed
      ? [comparisonPaths.component, comparisonPaths.removedVariant, "Archived"]
      : [comparisonPaths.quietParent, comparisonPaths.quietRemoved, "Old tag"];
    await page.goto(`/view/${parent}/`);
    await expect(page.getByLabel("Viewport", { exact: true })).toHaveValue(
      "both",
    );
    await chooseFilter(page, "changed");
    const removed = navRow(page, variant);
    await expect(removed).toHaveAttribute(
      "href",
      new RegExp(`/view/${variant}/\\?snapshot=[a-f0-9]{64}$`),
    );
    await removed.click();
    await expect(page).toHaveURL(
      new RegExp(`/view/${variant}/\\?snapshot=[a-f0-9]{64}$`),
    );
    await expect(page.locator("[data-workspace-variant-status]")).toHaveText(
      `${title} · Removed`,
    );
    // Arriving from Changes opens the first changed view of a quiet parent.
    await expect(page.getByLabel("Viewport", { exact: true })).toHaveValue(
      changed ? "both" : "mobile",
    );
    await expect(page.locator(".mbk-diff-toolbar")).toBeVisible();
    await page.getByRole("button", { name: "Side by side" }).click();
    await expect(page.locator("[data-current-screen]")).toBeHidden();
    await expect(page.locator("[data-diff-stage]")).toBeVisible();
    // Each shown viewport keeps its previous version and a missing side.
    const panes = changed ? 2 : 1;
    await expect(page.locator("[data-diff-stage] iframe")).toHaveCount(panes);
    await expect(page.locator(".mb-pane--after .mb-pane-missing")).toHaveCount(
      panes,
    );
  });
