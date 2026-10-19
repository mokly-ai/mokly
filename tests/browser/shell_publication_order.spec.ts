/**
 * Publication order in Serve, under the shell delivery contract: the shell
 * cancels a refresh that a newer publication overtakes, and its older
 * response cannot replace the newer state, whether the held response is the
 * index or the routed entry's detail. The shell adopts both publications
 * without a page load.
 */

import { expect, type APIResponse, type Route } from "@playwright/test";

import { test } from "./browser_test.js";
import {
  closeServe,
  liveIndex,
  replaceFile,
  screenFile,
  serveLiveCatalogue,
  settleLive,
} from "./live_shell_fixture.js";
import { endedRequests, passRenderingUpdates } from "./page_settling.js";

const HOME = "specs/home.screen.html";
const homeFile = (title: string) => screenFile(title, `<h1>${title} body</h1>`);

for (const held of ["index", "detail"] as const)
  test(`an older ${held} response for the route cannot replace a newer publication`, async ({
    page,
  }) => {
    const server = await serveLiveCatalogue();
    try {
      await page.goto(`${server.url}/view/home/`);
      const heading = page.locator("#mb-main h2");
      const row = page.locator(
        'nav.mbk-nav a[data-nav-row][data-entry-id="home"]',
      );
      await expect(heading).toHaveText("Home");
      // A property that only this page load carries; a page load drops it.
      await page.evaluate(() => {
        (window as unknown as { specMounted?: boolean }).specMounted = true;
      });
      let loads = 0;
      page.on("load", () => {
        loads += 1;
      });
      const holding: { route: Route; response: APIResponse }[] = [];
      let first = true;
      await page.route(
        held === "index"
          ? "**/mokly-viewer/index.json"
          : "**/mokly-viewer/entries/home.json",
        async (route) => {
          if (!first) return route.continue();
          first = false;
          // Read Serve's answer now, so the late response carries this state.
          holding.push({ route, response: await route.fetch() });
        },
      );
      const ended = endedRequests(page);
      const start = await liveIndex(server.url);

      // The first publication's refresh waits in the held request.
      await replaceFile(server.root, HOME, homeFile("Home two"));
      const second = await settleLive(server.url, start.revision, (index) =>
        index.screens.some((entry) => entry.title === "Home two"),
      );
      await expect.poll(() => holding.length).toBe(1);
      // A newer publication overtakes it.
      await replaceFile(server.root, HOME, homeFile("Home three"));
      const third = await settleLive(server.url, second, (index) =>
        index.screens.some((entry) => entry.title === "Home three"),
      );
      await expect(heading).toHaveText("Home three");
      // The row also holds the hidden Changed text of the navigation.
      await expect(row).toContainText("Home three");

      // Deliver the older response, wait until the browser ends that
      // request, then let the shell handle it: the newer state stays.
      const { route, response } = holding[0]!;
      const older = (await response.json()) as { revision: number };
      expect(older.revision).toBeLessThan(third);
      await route.fulfill({ response }).catch(() => undefined);
      await expect.poll(() => ended.has(route.request())).toBe(true);
      // The shell cancelled the refresh when the newer publication arrived.
      expect(route.request().failure()?.errorText).toBe("net::ERR_ABORTED");
      await passRenderingUpdates(page);
      await expect(heading).toHaveText("Home three");
      await expect(row).toContainText("Home three");
      await expect(
        page.frameLocator('[data-workspace-frame="desktop"]').locator("h1"),
      ).toHaveText("Home three body");
      // The shell adopted both publications in place, without a page load.
      expect(
        await page.evaluate(
          () => (window as unknown as { specMounted?: boolean }).specMounted,
        ),
      ).toBe(true);
      expect(loads).toBe(0);
    } finally {
      await closeServe(page, server);
    }
  });
