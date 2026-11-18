/**
 * Render failures of an embedded viewer and of the standalone shell, under the
 * embeddable viewer contract: an index of the supported version that the shell
 * cannot render shows the catalogue failure state with Try again, also when
 * the bad record breaks the selection, and Try again installs the catalogue.
 */

import { expect, type Page } from "@playwright/test";

import type { MoklyViewerProps } from "@mokly/viewer";

import { viewerFixture } from "../../packages/viewer/tests/browser_fixture.js";

import { test } from "./browser_test.js";
import type { ErrorAllowance } from "./error_monitor.js";
import { route, titles, WELCOME } from "./shell_route_fixture.js";

import type {} from "./viewer_harness.js";

let fixture: Awaited<ReturnType<typeof viewerFixture>>;
test.beforeAll(async () => {
  fixture = await viewerFixture();
});
test.afterAll(async () => {
  await fixture?.close();
});

/** The index with one screen that lists no views, so the shell cannot render it. */
function malformedEntry(index: { screens: readonly object[] }) {
  const [screen, ...screens] = index.screens;
  return { ...index, screens: [{ ...screen, views: null }, ...screens] };
}

/** React reports the render error that the viewer's catcher handles. */
function caughtRenderError(property: string): ErrorAllowance {
  return {
    kind: "console",
    message: new RegExp(
      `Cannot read properties of null \\(reading '${property}'\\)[\\s\\S]*error boundary you provided, CatalogueBoundary\\.`,
      "u",
    ),
  };
}

const failureText = /^The catalogue could not be loaded\s*Try again$/u;

/** Answer the viewer's URL index with `first` once, then with the fixture. */
async function answerIndex(page: Page, first: unknown) {
  const answers = { count: 0 };
  await page.route("**/public-catalogue.json", async (held) => {
    answers.count++;
    await held.fulfill({ json: answers.count === 1 ? first : fixture.index });
  });
  await page.evaluate(() => {
    const host = window.viewerHarness.get("one");
    host.props = {
      ...host.props,
      index: new URL("/public-catalogue.json", location.href),
      theme: "dark",
    } as MoklyViewerProps;
    delete host.props.baseUrl;
    host.render();
  });
  return answers;
}

async function errorEvents(page: Page) {
  return page.evaluate(() =>
    window.viewerHarness
      .get("one")
      .events.filter((event) => event.name === "error")
      .map((event) => event.value),
  );
}

const catalogueError = {
  code: "catalogue",
  message: "The catalogue could not be loaded. Try again.",
};

test("an index with a malformed entry shows the failure state, and Try again installs the catalogue", async ({
  page,
  allowBrowserError,
}) => {
  allowBrowserError(caughtRenderError("map"));
  await page.goto(fixture.host.url);
  await page.waitForFunction(() => Boolean(window.viewerHarness));
  await page.evaluate(() => window.viewerHarness.start("one"));
  const answers = await answerIndex(page, malformedEntry(fixture.index));
  const viewer = page.locator("#one .mokly-viewer");
  const failure = page.locator("#one").getByRole("alert");
  await expect(failure).toHaveText(failureText);
  await expect(viewer).toHaveAttribute("data-mokly-theme", "dark");
  await failure.getByRole("button", { name: "Try again" }).click();
  await expect(
    page.getByRole("heading", { name: "Home", exact: true }),
  ).toBeVisible();
  await expect(viewer).toHaveAttribute("data-mokly-theme", "dark");
  expect(answers.count).toBe(2);
  expect(await errorEvents(page)).toEqual([catalogueError]);
});

test("a malformed record before the selected component shows the failure state, not an unavailable selection", async ({
  page,
  allowBrowserError,
}) => {
  allowBrowserError(caughtRenderError("path"));
  const [component] = fixture.index.components;
  await page.goto(fixture.host.url);
  await page.waitForFunction(() => Boolean(window.viewerHarness));
  await page.evaluate(
    (screenPath) =>
      window.viewerHarness.start("one", { defaultSelection: { screenPath } }),
    component!.path,
  );
  // The selection looks for the component after the documents.
  const answers = await answerIndex(page, {
    ...fixture.index,
    documents: [null, ...fixture.index.documents],
  });
  const failure = page.locator("#one").getByRole("alert");
  await expect(failure).toHaveText(failureText);
  await failure.getByRole("button", { name: "Try again" }).click();
  await expect(
    page
      .locator("#one")
      .getByRole("heading", { level: 2, name: component!.title, exact: true }),
  ).toBeVisible();
  expect(answers.count).toBe(2);
  expect(await errorEvents(page)).toEqual([catalogueError]);
});

test("a standalone index with a malformed entry shows the failure state, and Try again installs the catalogue", async ({
  page,
  request,
  baseURL,
  allowBrowserError,
}) => {
  allowBrowserError({
    kind: "console",
    message: /^TypeError: Cannot read properties of null \(reading 'map'\)/u,
    url: new RegExp(
      `^${new URL("/mokly-viewer/client/shell.js", baseURL).href.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`,
      "u",
    ),
  });
  const names = await titles(request);
  let reads = 0;
  await page.route("**/mokly-viewer/index.json", async (held) => {
    reads += 1;
    if (reads > 1) return held.continue();
    const response = await held.fetch();
    const index = (await response.json()) as { screens: object[] };
    await held.fulfill({ response, json: malformedEntry(index) });
  });
  await page.goto(route(WELCOME));
  const failure = page
    .getByRole("alert")
    .filter({ hasText: "The catalogue could not be loaded" });
  await expect(failure).toHaveText(failureText);
  const navigation = page.getByRole("navigation", { name: "Catalogue" });
  await expect(navigation).toHaveCount(0);
  await failure.getByRole("button", { name: "Try again" }).click();
  await expect(page.locator("#mb-main h2")).toHaveText(names.get(WELCOME)!);
  await expect(navigation).toBeVisible();
  expect(reads).toBe(2);
});
