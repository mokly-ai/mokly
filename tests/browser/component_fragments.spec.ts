import { expect } from "@playwright/test";

import { viewRoute } from "@mokly/viewer/data";

import { browserSources } from "../../packages/viewer/tests/browser_sources.js";

import { test } from "./browser_test.js";
import { componentFragmentFixture } from "./component_fragment_fixture.js";
import { documentFavicon } from "./document_error_allowance.js";

let fixture: Awaited<ReturnType<typeof componentFragmentFixture>>;
test.beforeEach(({ allowBrowserError }) => {
  documentFavicon(allowBrowserError, fixture.url);
});
const expectedEntries = [
  "action",
  "action/default",
  "action/disabled",
  "pane",
  "pane/default",
];
test.beforeAll(async () => {
  fixture = await componentFragmentFixture({
    "specs/index.mockup.tsx": browserSources({
      body: '<pane.Component><action.Component label="Slot action" /></pane.Component><MockLink to="action/default">Open Action</MockLink>',
      actionRender:
        "(props, context) => <button disabled={props.disabled} data-viewport={context.viewport} data-scheme={context.colorScheme}>{props.label}</button>",
    }),
  });
  const index = fixture.index;
  expect(
    index.components.map((entry: { path: string }) => entry.path).sort(),
  ).toEqual(expectedEntries);
});
test.afterAll(async () => fixture?.close());

for (const viewport of ["mobile", "desktop"] as const) {
  for (const scheme of ["light", "dark"] as const) {
    test(`${viewport}/${scheme}: parent props and saved component variants have portable documents`, async ({
      page,
    }) => {
      const networkRequests: string[] = [];
      page.on("request", (request) => {
        if (/^https?:/.test(request.url())) networkRequests.push(request.url());
      });
      const url = (entry: string) =>
        `${fixture.url}/static/mokly-generated/${viewRoute(entry, viewport, scheme)}`;
      await page.goto(url("home"));
      await expect(
        page.getByRole("button", { name: "Slot action", exact: true }),
      ).toBeVisible();
      await expect(
        page.getByRole("button", { name: "Inside", exact: true }),
      ).toBeVisible();
      await page.getByRole("link", { name: "Open Action" }).click();
      await expect(page).toHaveURL(url("action/default"));
      for (const entry of expectedEntries) {
        await page.goto(url(entry));
        const button = page.getByRole("button", {
          name: entry.startsWith("action") ? "Continue" : "Inside",
          exact: true,
        });
        await expect(button).toHaveAttribute("data-viewport", viewport);
        await expect(button).toHaveAttribute("data-scheme", scheme);
        if (entry === "action/disabled") await expect(button).toBeDisabled();
        else await expect(button).toBeEnabled();
        if (entry === "pane/default")
          await expect(
            page.getByText("Saved content", { exact: true }),
          ).toBeVisible();
      }
      if (process.env["MOKLY_PLAYWRIGHT_FILE_DIR"]) {
        expect(new URL(page.url()).protocol).toBe("file:");
        expect(networkRequests).toEqual([]);
      }
    });
  }
}
