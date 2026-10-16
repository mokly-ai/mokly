import { expect } from "@playwright/test";

import { viewRoute } from "@mokly/viewer/data";

import { crossOriginFixture } from "../../packages/viewer/tests/standalone_fixture.js";

import { test } from "./browser_test.js";

let fixture: Awaited<ReturnType<typeof crossOriginFixture>>;
test.beforeAll(async () => {
  fixture = await crossOriginFixture();
});
test.afterAll(async () => fixture?.close());

for (const viewport of ["mobile", "desktop"] as const) {
  for (const scheme of ["light", "dark"] as const) {
    test(`${viewport}/${scheme}: parent props and saved component variants have portable documents`, async ({
      page,
    }) => {
      for (const entry of fixture.index.components) {
        await page.goto(
          `${fixture.host.url}/static/mokly-generated/${viewRoute(entry.path, viewport, scheme)}`,
        );
        if (entry.path.startsWith("action")) {
          if (entry.path === "action/disabled")
            await expect(page.getByText("First root")).toBeVisible();
          else
            await expect(
              page.getByRole("button", { name: "Continue" }),
            ).toBeVisible();
        } else
          await expect(
            page.getByRole("button", { name: "Inside" }),
          ).toBeVisible();
      }
    });
  }
}
