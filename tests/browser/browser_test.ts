import { expect, test as base } from "@playwright/test";

import { drainBrowserFixtures } from "../../packages/viewer/tests/browser_cleanup.js";

import {
  allowedBrowserFailure,
  monitorBrowser,
  type ErrorAllowance,
  type BrowserFailure,
} from "./error_monitor.js";

/** Worker teardown also owns resources from a failed or interrupted beforeAll. */
export const test = base.extend<
  {
    browserErrors: readonly BrowserFailure[];
    browserErrorAllowances: ErrorAllowance[];
    expectedBrowserErrors: ErrorAllowance[];
    allowBrowserError: (rule: ErrorAllowance) => void;
  },
  { fixtureCleanup: void }
>({
  expectedBrowserErrors: [[], { option: true }],
  browserErrorAllowances: async ({ expectedBrowserErrors }, use) => {
    await use([...expectedBrowserErrors]);
  },
  allowBrowserError: async ({ browserErrorAllowances }, use) => {
    await use((rule) => {
      browserErrorAllowances.push(rule);
    });
  },
  browserErrors: [
    async ({ browser, browserErrorAllowances, javaScriptEnabled }, use) => {
      const monitor = monitorBrowser(browser, javaScriptEnabled);
      try {
        await use(monitor.failures);
      } finally {
        await monitor.finish();
        expect(
          monitor.failures.filter(
            (failure) =>
              !allowedBrowserFailure(failure, browserErrorAllowances),
          ),
          "Unexpected browser errors",
        ).toEqual([]);
      }
    },
    { auto: true },
  ],
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
