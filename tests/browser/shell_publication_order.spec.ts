/**
 * Publication order in Serve, under the shell delivery contract: a refresh
 * that a newer publication overtakes cannot replace the newer state, whether
 * the held response is the index or the routed entry's detail, and the shell
 * adopts both publications without a page load.
 */

import { expect, type Route } from "@playwright/test";

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
      const holding: Route[] = [];
      await page.route(
        held === "index"
          ? "**/mokly-viewer/index.json"
          : "**/mokly-viewer/entries/home.json",
        (route) => {
          if (holding.length) return route.continue();
          holding.push(route);
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
      await settleLive(server.url, second, (index) =>
        index.screens.some((entry) => entry.title === "Home three"),
      );
      await expect(heading).toHaveText("Home three");
      // The row also holds the hidden Changed text of the navigation.
      await expect(row).toContainText("Home three");

      // Release the older response, wait until the browser ends it, then let
      // the shell handle it: the newer state stays.
      await holding[0]!.continue().catch(() => undefined);
      await expect.poll(() => ended.has(holding[0]!.request())).toBe(true);
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
