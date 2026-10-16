/**
 * The client-rendered shell over Serve of the example, under the shell
 * delivery contract: the stub mount, in-shell history, scroll and search
 * retention, latest-wins navigation, and detail failure with retry.
 */

import { expect, type APIRequestContext, type Page } from "@playwright/test";

import { captureBrowserErrors, checkBrowserErrors } from "./browser_errors.js";
import { test } from "./browser_test.js";

const WELCOME = "example/screens/welcome";
const DETAILS = "example/screens/details";
const MEMBERS = "example/team/members";

/** Entry titles from the served index, so the spec never copies them. */
async function titles(request: APIRequestContext) {
  const index = (await (
    await request.get("/mokly-viewer/index.json")
  ).json()) as { screens: { path: string; title: string }[] };
  return new Map(index.screens.map((entry) => [entry.path, entry.title]));
}

const heading = (page: Page) => page.locator("#mb-main h2");
const navLink = (page: Page, path: string) =>
  page.locator(`a[data-entry-id="${path}"][data-nav-row]`);
const route = (path: string) => `/view/${path}/`;

/** Open a specs folder that starts closed, so its rows can be clicked. */
async function openFolder(page: Page, folder: string) {
  const details = page.locator(
    `[data-nav-section="specs"] details[data-nav-folder="folder:${folder}"]`,
  );
  if (
    !(await details.evaluate((element) => (element as HTMLDetailsElement).open))
  )
    await details.locator(":scope > summary").click();
}

/** Paths of the index and detail reads that a page makes from now on. */
function readsOf(page: Page): string[] {
  const reads: string[] = [];
  page.on("request", (request) => {
    const { pathname } = new URL(request.url());
    if (/^\/mokly-viewer\/(?:index\.json|entries\/)/.test(pathname))
      reads.push(pathname);
  });
  return reads;
}

test.describe("with a clean console", () => {
  checkBrowserErrors();

  test("the stub mounts the routed entry from the index and its own detail", async ({
    page,
    request,
  }) => {
    const names = await titles(request);
    const stub = await (await request.get(route(WELCOME))).text();
    expect(stub).toBe(await (await request.get("/")).text());
    expect(stub.match(/data-mokly-shell/g)).toHaveLength(1);
    expect(stub).toContain(
      '<script type="module" src="/mokly-viewer/client/shell.js"></script>',
    );
    expect(stub).toContain("<noscript>");
    expect(stub).not.toContain(WELCOME);
    const reads = readsOf(page);
    await page.goto(route(WELCOME));
    await expect(heading(page)).toHaveText(names.get(WELCOME)!);
    await expect(page.locator("#mb-main iframe")).toHaveCount(2);
    expect(reads).toEqual([
      "/mokly-viewer/index.json",
      `/mokly-viewer/entries/${WELCOME}.json`,
    ]);
  });

  test("in-shell navigation commits each route without a page load, and history restores it", async ({
    page,
    request,
  }) => {
    const names = await titles(request);
    await page.goto(route(WELCOME));
    await expect(heading(page)).toHaveText(names.get(WELCOME)!);
    let loads = 0;
    page.on("load", () => {
      loads += 1;
    });
    const crumbs = page.locator('p[aria-label="Catalogue location"]');
    const welcomeCrumbs = await crumbs.textContent();
    await openFolder(page, "example/team");
    await navLink(page, MEMBERS).click();
    await expect(page).toHaveURL(new RegExp(`${route(MEMBERS)}$`));
    await expect(heading(page)).toHaveText(names.get(MEMBERS)!);
    await expect(crumbs).not.toHaveText(welcomeCrumbs ?? "");
    await page.goBack();
    await expect(page).toHaveURL(new RegExp(`${route(WELCOME)}$`));
    await expect(heading(page)).toHaveText(names.get(WELCOME)!);
    await expect(crumbs).toHaveText(welcomeCrumbs ?? "");
    await page.goForward();
    await expect(heading(page)).toHaveText(names.get(MEMBERS)!);
    await expect(page.locator("#mb-main iframe").first()).toHaveAttribute(
      "title",
      new RegExp(`^${names.get(MEMBERS)} — `),
    );
    expect(loads).toBe(0);
  });

  test("Back and Forward restore each route's stage scroll", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 520 });
    await page.goto(route(WELCOME));
    const stage = page.locator('[data-mokly-scroll="stage"]');
    await expect(page.locator("#mb-main iframe")).toHaveCount(2);
    await expect
      .poll(() =>
        stage.evaluate((element) => {
          element.scrollTop = 160;
          return element.scrollTop;
        }),
      )
      .toBe(160);
    await openFolder(page, "example/team");
    await navLink(page, MEMBERS).click();
    await expect(page).toHaveURL(new RegExp(`${route(MEMBERS)}$`));
    await expect
      .poll(() => stage.evaluate((element) => element.scrollTop))
      .toBe(0);
    await page.goBack();
    await expect(page).toHaveURL(new RegExp(`${route(WELCOME)}$`));
    await expect
      .poll(() => stage.evaluate((element) => element.scrollTop))
      .toBe(160);
  });

  test("the search text stays while the shell navigates", async ({
    page,
    request,
  }) => {
    const names = await titles(request);
    await page.goto(route(WELCOME));
    const search = page.getByRole("searchbox", { name: "Search catalogue" });
    await search.fill(names.get(MEMBERS)!);
    await openFolder(page, "example/team");
    await navLink(page, MEMBERS).click();
    await expect(heading(page)).toHaveText(names.get(MEMBERS)!);
    await expect(search).toHaveValue(names.get(MEMBERS)!);
  });

  test("overlapping navigations commit the latest route only", async ({
    page,
    request,
  }) => {
    const names = await titles(request);
    await page.goto(route(WELCOME));
    await expect(heading(page)).toHaveText(names.get(WELCOME)!);
    let release!: () => void;
    const released = new Promise<void>((resolve) => {
      release = resolve;
    });
    await page.route(
      `**/mokly-viewer/entries/${DETAILS}.json`,
      async (held) => {
        await released;
        await held.continue().catch(() => undefined);
      },
    );
    await navLink(page, DETAILS).click();
    await expect(heading(page)).toHaveText(names.get(DETAILS)!);
    await expect(page.getByText("Loading preview…")).toBeVisible();
    await openFolder(page, "example/team");
    await navLink(page, MEMBERS).click();
    await expect(heading(page)).toHaveText(names.get(MEMBERS)!);
    await expect(page.locator("#mb-main iframe")).toHaveCount(2);
    release();
    await page.unrouteAll({ behavior: "wait" });
    await expect(page).toHaveURL(new RegExp(`${route(MEMBERS)}$`));
    await expect(heading(page)).toHaveText(names.get(MEMBERS)!);
    for (const frame of await page.locator("#mb-main iframe").all())
      await expect(frame).toHaveAttribute(
        "title",
        new RegExp(`^${names.get(MEMBERS)} — `),
      );
  });

  test("the skip link adds fragment history without reading the route again", async ({
    page,
    request,
  }) => {
    const names = await titles(request);
    await page.goto(route(WELCOME));
    await expect(page.locator("#mb-main iframe")).toHaveCount(2);
    const reads = readsOf(page);
    await page.getByRole("link", { name: "Skip to content" }).focus();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(new RegExp(`${route(WELCOME)}#mb-main$`));
    await page.goBack();
    await expect(page).toHaveURL(new RegExp(`${route(WELCOME)}$`));
    await expect(heading(page)).toHaveText(names.get(WELCOME)!);
    await expect(page.locator("#mb-main iframe")).toHaveCount(2);
    expect(reads).toEqual([]);
  });
});

test("a failed detail shows the unavailable state, and Try again loads the route", async ({
  page,
  request,
}) => {
  const errors = captureBrowserErrors(page);
  const names = await titles(request);
  await page.goto(route(WELCOME));
  await expect(heading(page)).toHaveText(names.get(WELCOME)!);
  let failing = true;
  await page.route(`**/mokly-viewer/entries/${DETAILS}.json`, (held) =>
    failing ? held.fulfill({ status: 500, body: "" }) : held.continue(),
  );
  await navLink(page, DETAILS).click();
  const alert = page
    .getByRole("alert")
    .filter({ hasText: "This screen could not be shown" });
  await expect(alert).toBeVisible();
  await expect(navLink(page, WELCOME)).toBeVisible();
  failing = false;
  await alert.getByRole("button", { name: "Try again" }).click();
  await expect(page.locator("#mb-main iframe")).toHaveCount(2);
  await expect(alert).toHaveCount(0);
  await expect(heading(page)).toHaveText(names.get(DETAILS)!);
  await page.unrouteAll({ behavior: "ignoreErrors" });
  expect(errors.filter((error) => !/\b500\b/.test(error))).toEqual([]);
});
