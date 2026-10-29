/**
 * The client-rendered shell over Serve of the example, under the shell
 * delivery contract: the stub mount, in-shell history, scroll and search
 * retention, latest-wins navigation, frame handoff, the detail fences, and
 * detail failure with retry.
 */

import { expect, type Route } from "@playwright/test";

import { historyScrolls } from "../../packages/viewer/src/shell/store_scroll.js";

import { desktopFrame, mobileFrame } from "./browse_assertions.js";
import { test } from "./browser_test.js";
import { networkFailure, responseFailure } from "./shell_error_allowances.js";
import {
  DETAILS,
  heading,
  holdReads,
  loadsOf,
  MEMBERS,
  navLink,
  openFolder,
  readsOf,
  rewritten,
  route,
  titles,
  WELCOME,
} from "./shell_route_fixture.js";
import { chooseScheme, expectFrameLoaded } from "./workspace_actions.js";

test.describe("with a clean console", () => {
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
    const loads = loadsOf(page);
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
    expect(loads.count).toBe(0);
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
    await expect
      .poll(
        async () =>
          historyScrolls(await page.evaluate(() => history.state))["stage"],
      )
      .toBe(160);
    await openFolder(page, "example/team");
    await navLink(page, MEMBERS).click();
    await expect(page).toHaveURL(new RegExp(`${route(MEMBERS)}$`));
    await expect
      .poll(() => stage.evaluate((element) => element.scrollTop))
      .toBe(0);
    await expect(page.locator("#mb-main iframe")).toHaveCount(2);
    await expect
      .poll(() =>
        stage.evaluate((element) => {
          element.scrollTop = 120;
          return element.scrollTop;
        }),
      )
      .toBe(120);
    // The scroll offset changes before the scroll event saves it in history.
    await expect
      .poll(
        async () =>
          historyScrolls(await page.evaluate(() => history.state))["stage"],
      )
      .toBe(120);
    await page.goBack();
    await expect(page).toHaveURL(new RegExp(`${route(WELCOME)}$`));
    await expect
      .poll(() => stage.evaluate((element) => element.scrollTop))
      .toBe(160);
    await page.goForward();
    await expect(page).toHaveURL(new RegExp(`${route(MEMBERS)}$`));
    await expect
      .poll(() => stage.evaluate((element) => element.scrollTop))
      .toBe(120);
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
    const release = await holdReads(
      page,
      `/mokly-viewer/entries/${DETAILS}.json`,
    );
    await navLink(page, DETAILS).click();
    await expect(heading(page)).toHaveText(names.get(DETAILS)!);
    await expect(page.getByText("Loading preview…")).toBeVisible();
    const aborted = page.waitForEvent(
      "requestfailed",
      (failed) =>
        new URL(failed.url()).pathname ===
        `/mokly-viewer/entries/${DETAILS}.json`,
    );
    await openFolder(page, "example/team");
    await navLink(page, MEMBERS).click();
    await expect(heading(page)).toHaveText(names.get(MEMBERS)!);
    await aborted;
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

  test("a scheme change while one frame document is pending ends with every frame on that scheme", async ({
    page,
  }) => {
    const darkDocument = (viewport: string) =>
      new RegExp(`/${WELCOME}/index\\.${viewport}\\.dark\\.html$`);
    await page.goto(route(WELCOME));
    await expect(page.locator("#mb-main iframe")).toHaveCount(2);
    const release = await holdReads(
      page,
      `/${WELCOME}/index.desktop.dark.html`,
    );
    await chooseScheme(page, "dark");
    await expectFrameLoaded(page.locator(mobileFrame), darkDocument("mobile"));
    release();
    await expectFrameLoaded(
      page.locator(desktopFrame),
      darkDocument("desktop"),
    );
    await expectFrameLoaded(page.locator(mobileFrame), darkDocument("mobile"));
    await page.unrouteAll({ behavior: "wait" });
  });
});

test("a detail of another deployment loads the requested URL again", async ({
  page,
  request,
}) => {
  const names = await titles(request);
  await page.goto(route(WELCOME));
  await expect(heading(page)).toHaveText(names.get(WELCOME)!);
  const loads = loadsOf(page);
  const replaced = rewritten((body) => ({
    ...body,
    detailId: "f".repeat(64),
  }));
  let reads = 0;
  await page.route(`**/mokly-viewer/entries/${DETAILS}.json`, (held) =>
    reads++ === 0 ? replaced(held) : held.continue(),
  );
  await navLink(page, DETAILS).click();
  await expect.poll(() => loads.count).toBe(1);
  await expect(page).toHaveURL(new RegExp(`${route(DETAILS)}$`));
  await expect(heading(page)).toHaveText(names.get(DETAILS)!);
  await expect(page.locator("#mb-main iframe")).toHaveCount(2);
  expect(reads).toBe(2);
});

/**
 * Ways a destination detail can fail, and the index reads each one makes:
 * only a detail of another revision reads the index once more before the
 * shell gives up.
 */
const FAILURES: readonly [string, (held: Route) => Promise<void>, number][] = [
  ["an error status", (held) => held.fulfill({ status: 500, body: "" }), 0],
  ["a network failure", (held) => held.abort("failed"), 0],
  [
    "a detail of another revision",
    rewritten((body) => ({ ...body, revision: Number(body.revision) + 1000 })),
    1,
  ],
  [
    "a detail of another catalogue",
    rewritten((body) => ({
      ...body,
      identity: { ...(body.identity as object), title: "Another catalogue" },
    })),
    0,
  ],
];

for (const [failure, answer, indexReads] of FAILURES)
  test(`${failure} shows the unavailable state, and Try again loads the route`, async ({
    page,
    request,
    baseURL,
    allowBrowserError,
  }) => {
    const detailPath = `/mokly-viewer/entries/${DETAILS}.json`;
    if (failure === "an error status")
      allowBrowserError(responseFailure(baseURL!, detailPath, 500));
    if (failure === "a network failure")
      allowBrowserError(networkFailure(baseURL!, detailPath));
    const names = await titles(request);
    await page.goto(route(WELCOME));
    await expect(heading(page)).toHaveText(names.get(WELCOME)!);
    let failing = true;
    await page.route(`**/mokly-viewer/entries/${DETAILS}.json`, (held) =>
      failing ? answer(held) : held.continue(),
    );
    const reads = readsOf(page);
    const indexReadsSoFar = () =>
      reads.filter((path) => path === "/mokly-viewer/index.json").length;
    await navLink(page, DETAILS).click();
    const alert = page
      .getByRole("alert")
      .filter({ hasText: "This screen could not be shown" });
    await expect(alert).toBeVisible();
    expect(indexReadsSoFar()).toBe(indexReads);
    await expect(heading(page).first()).toHaveText(names.get(DETAILS)!);
    await expect(page.locator("#mb-main iframe")).toHaveCount(0);
    await expect(navLink(page, WELCOME)).toBeVisible();
    failing = false;
    await alert.getByRole("button", { name: "Try again" }).click();
    await expect(page.locator("#mb-main iframe")).toHaveCount(2);
    await expect(alert).toHaveCount(0);
    await expect(heading(page)).toHaveText(names.get(DETAILS)!);
    expect(indexReadsSoFar()).toBe(indexReads);
    await page.unrouteAll({ behavior: "ignoreErrors" });
  });
