import { test as base } from "@playwright/test";

import { drainBrowserFixtures } from "../../packages/viewer/tests/browser_cleanup.js";

/** Worker teardown also owns resources from a failed or interrupted beforeAll. */
export const test = base.extend<object, { fixtureCleanup: void }>({
  fixtureCleanup: [
    async ({ browser }, use) => {
      void browser;
      try {
        await use();
      } finally {
        await drainBrowserFixtures();
      }
    },
    { scope: "worker", auto: true },
  ],
});
