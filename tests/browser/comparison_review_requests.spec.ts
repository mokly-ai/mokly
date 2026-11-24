import { expect, type Request } from "@playwright/test";

import {
  expectPaneDocumentsKept,
  markPaneDocuments,
} from "./comparison_scroll.js";
import { comparisonPaths, test } from "./comparison_test.js";
import {
  awaitRoutedDetail,
  chooseMode,
  compareStage,
  compareState,
  comparisonFrames,
  comparisonIndex,
  expectNoCompareModes,
  modeButton,
  navRow,
} from "./comparison_ui.js";
import { inspectTitle } from "./inspect_head.js";
import { endedRequests, passRenderingUpdates } from "./page_settling.js";
import { responseFailure } from "./shell_error_allowances.js";
import { canvasFrame, setFrames } from "./workspace_actions.js";

/** Every pane document of a comparison generation, without subresources. */
const DOCUMENTS = "**/mokly-viewer/diffs/generations/*/snapshots/**/*.html";

test("pending requests cannot replace Current or a newly navigated screen", async ({
  page,
}) => {
  let release = (): void => undefined;
  const waiting = new Promise<void>((resolve) => {
    release = resolve;
  });
  const heldRequests: Request[] = [];
  await page.route(DOCUMENTS, async (route) => {
    heldRequests.push(route.request());
    const response = await route.fetch();
    await waiting;
    await route.fulfill({ response }).catch(() => undefined);
  });
  const ended = endedRequests(page);
  await page.goto(`/view/${comparisonPaths.changed}/`);
  await chooseMode(page, "Overlay");
  await expect(compareState(page)).toContainText("Loading comparison");
  // Move on only once the shell holds a request for a pane document.
  await expect.poll(() => heldRequests.length).toBeGreaterThan(0);
  await modeButton(page, "Current").click();
  // Current shows the live frames again, and no frame compares.
  await expect(page.locator(canvasFrame("desktop"))).toBeVisible();
  await expect(comparisonFrames(page)).toHaveCount(0);
  await navRow(page, comparisonPaths.unchanged).click();
  await expect(inspectTitle(page)).toHaveText("Stable screen");
  // Release the held documents, wait until the browser ends those requests
  // (the shell cancels them when the reader chooses Current), then let the
  // shell handle and render the outcome.
  release();
  await expect
    .poll(() => heldRequests.every((held) => ended.has(held)))
    .toBe(true);
  await passRenderingUpdates(page);
  await expect(inspectTitle(page)).toHaveText("Stable screen");
  await expect(comparisonFrames(page)).toHaveCount(0);
  await awaitRoutedDetail(page, comparisonPaths.unchanged);
  await expectNoCompareModes(page);
  await expect(page.locator("[data-workspace-status]")).toHaveText(
    "Unmodified",
  );
});

test("a failed comparison stays in the screen and retries explicitly", async ({
  page,
  request,
  baseURL,
  allowBrowserError,
}) => {
  const index = await comparisonIndex(request, baseURL);
  const failing = `/${index.comparisonUrl}snapshots/before/mokly-generated/${comparisonPaths.changed}/index.mobile.html`;
  allowBrowserError(responseFailure(baseURL!, failing, 500));
  await page.route(
    `**${failing}`,
    (route) => route.fulfill({ status: 500, body: "failed" }),
    { times: 1 },
  );
  await page.goto(`/view/${comparisonPaths.changed}/`);
  await chooseMode(page, "Overlay");
  const retry = page.getByRole("button", { name: "Try again", exact: true });
  await expect(retry).toBeVisible();
  await expect(inspectTitle(page)).toHaveText("Changed screen");
  await expect(modeButton(page, "Overlay")).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await retry.click();
  // Each of the canvas's four frames stacks its two versions.
  await expect(comparisonFrames(page)).toHaveCount(8);
  await expect(comparisonFrames(page).first()).toHaveAttribute(
    "data-mokly-preview-source",
    /\/snapshots\/before\//,
  );
});

test("a retry presents the pinned generation, and leaving abandons a pending refresh", async ({
  page,
  request,
  baseURL,
  allowBrowserError,
}) => {
  const index = await comparisonIndex(request, baseURL);
  const generation = new URL(index.comparisonUrl, baseURL).href;
  const failing = `/${index.comparisonUrl}snapshots/before/mokly-generated/${comparisonPaths.changed}/index.mobile.html`;
  allowBrowserError(responseFailure(baseURL!, failing, 503));
  await page.route(
    `**${failing}`,
    (route) => route.fulfill({ status: 503, body: "unavailable" }),
    { times: 1 },
  );
  await page.goto(`/view/${comparisonPaths.changed}/?viewport=mobile`);
  // The Frames filter shows the Mobile · Light frame alone, so one frame
  // compares, here and after the navigation below.
  await setFrames(page, {
    mobile: true,
    desktop: false,
    light: true,
    dark: false,
  });
  await chooseMode(page, "Overlay");
  await page.getByRole("button", { name: "Try again", exact: true }).click();
  const frames = comparisonFrames(page);
  await expect(frames).toHaveCount(2);
  const sources = () =>
    frames.evaluateAll((items) =>
      items.map((item) => item.getAttribute("data-mokly-preview-source")),
    );
  /** The pinned generation's Before and Current mobile documents of one screen. */
  const pinned = (entry: string) =>
    (["before", "after"] as const).map(
      (side) =>
        `${generation}snapshots/${side}/mokly-generated/${entry}/index.mobile.html`,
    );
  expect(await sources()).toEqual(pinned(comparisonPaths.changed));

  // Hold every document read: leave during the refresh's reads for another
  // changed screen, and open its comparison while all of them wait.
  const held: { request: Request; open: () => void }[] = [];
  await page.route(DOCUMENTS, async (route) => {
    let open = (): void => undefined;
    const gate = new Promise<void>((resolve) => {
      open = resolve;
    });
    held.push({ request: route.request(), open });
    const response = await route.fetch();
    await gate;
    await route.fulfill({ response }).catch(() => undefined);
  });
  const ended = endedRequests(page);
  await page.getByRole("button", { name: "Refresh comparison" }).click();
  await expect.poll(() => held.length).toBe(2);
  await expect(compareStage(page)).toHaveAttribute("aria-busy", "true");
  await navRow(page, comparisonPaths.lightOnly).click();
  const heading = inspectTitle(page);
  await expect(heading).toHaveText("Daylight screen");
  await chooseMode(page, "Overlay");
  await expect.poll(() => held.length).toBe(4);
  /** The destination presents its own versions. */
  const expectDaylight = async () => {
    await expect(heading).toHaveText("Daylight screen");
    await expect(frames).toHaveCount(2);
    await expect.poll(sources).toEqual(pinned(comparisonPaths.lightOnly));
    for (const [index, text] of ["Daylight Before", "Daylight After"].entries())
      await expect(frames.nth(index).contentFrame().locator("h1")).toHaveText(
        text,
      );
  };
  // The destination's reads end first; the abandoned refresh's reads end
  // after them, and change nothing.
  for (const destination of held.slice(2)) destination.open();
  await expectDaylight();
  await markPaneDocuments(compareStage(page));
  for (const abandoned of held.slice(0, 2)) abandoned.open();
  await expect
    .poll(() => held.slice(0, 2).every(({ request }) => ended.has(request)))
    .toBe(true);
  await passRenderingUpdates(page);
  await expectDaylight();
  // The same pane documents stay, not equal replacements.
  await expectPaneDocumentsKept(compareStage(page));
});
