/**
 * The client-rendered shell over Serve of the example, under the shell
 * delivery contract: the stub mount, in-shell history, and a failed detail
 * with retry. `shell_client_route_layouts.spec.ts` covers each layout's stage
 * history. Unit tests own the detail fences and the failure outcome of each
 * fence; `browse_folder_rows.spec.ts` keeps the search on navigation, and
 * `static_deployment_flow.spec.ts` loads the page again for another
 * deployment.
 */

import { expect, type Route } from "@playwright/test";

import { test } from "./browser_test.js";
import { networkFailure } from "./shell_error_allowances.js";
import {
  CANVAS_FRAMES,
  DETAILS,
  heading,
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
    await expect(page.locator("#mb-main iframe")).toHaveCount(CANVAS_FRAMES);
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
    // Inspect's Path row names each route's folders.
    const crumbs = page.locator("[data-inspect-path] code");
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
});

/**
 * Ways a destination detail can fail, and the index reads each one makes:
 * only a detail of another revision reads the index once more before the
 * shell gives up.
 */
const FAILURES: readonly [string, (held: Route) => Promise<void>, number][] = [
  ["a network failure", (held) => held.abort("failed"), 0],
  [
    "a detail of another revision",
    rewritten((body) => ({ ...body, revision: Number(body.revision) + 1000 })),
    1,
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
    await expect(heading(page)).toHaveText(names.get(DETAILS)!);
    await expect(page.locator("#mb-main iframe")).toHaveCount(0);
    await expect(navLink(page, WELCOME)).toBeVisible();
    failing = false;
    await alert.getByRole("button", { name: "Try again" }).click();
    await expect(page.locator("#mb-main iframe")).toHaveCount(CANVAS_FRAMES);
    await expect(alert).toHaveCount(0);
    await expect(heading(page)).toHaveText(names.get(DETAILS)!);
    expect(indexReadsSoFar()).toBe(indexReads);
    await page.unrouteAll({ behavior: "ignoreErrors" });
  });
