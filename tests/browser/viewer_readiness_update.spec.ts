import path from "node:path";

import { expect, test } from "@playwright/test";
import { build } from "esbuild";

import type { CatalogueReadModel } from "../../packages/viewer/src/catalogue/types.js";
import type {} from "../../packages/viewer/tests/readiness_entry.js";

import { crossOriginFixture } from "./frame_adapter_fixture.js";

let fixture: Awaited<ReturnType<typeof crossOriginFixture>>;
test.beforeAll(async () => {
  fixture = await crossOriginFixture({
    body: '<action.Component label="Visible" />',
  });
  await build({
    entryPoints: ["packages/viewer/tests/readiness_entry.ts"],
    outfile: path.join(fixture.root, "readiness.js"),
    bundle: true,
    platform: "browser",
    format: "iife",
    target: "es2023",
    logLevel: "silent",
  });
});
test.afterAll(async () => fixture?.close());

for (const cross of [false, true]) {
  for (const status of ["pending", "unavailable"] as const) {
    test(`${cross ? "postMessage" : "same-origin"} viewer update enables ${status} sibling on the same document`, async ({
      page,
    }) => {
      await page.goto(fixture.host.url);
      await page.addScriptTag({ url: `${fixture.host.url}/readiness.js` });
      await page.evaluate(
        ({ model, origin, cross, status }) =>
          window.startReadiness(
            JSON.parse(model) as CatalogueReadModel,
            origin,
            cross,
            status,
          ),
        {
          model: JSON.stringify(fixture.catalogue),
          origin: fixture.frames.url,
          cross,
          status,
        },
      );
      await page.evaluate(async () => {
        const probe = window.readiness;
        await probe.frames.highlight(probe.instance);
      });
      const sibling = page.frameLocator(
        'iframe[data-workspace-frame="desktop"]',
      );
      const button = sibling.getByRole("button", {
        name: "Visible",
        exact: true,
      });
      await button.waitFor();
      const body = await sibling.locator("body").elementHandle();
      await page.evaluate(() => window.readiness.update());
      await button.hover();
      await expect
        .poll(() => page.evaluate(() => window.readiness.events))
        .toContain("hover:desktop");
      await button.click();
      await expect
        .poll(() => page.evaluate(() => window.readiness.events))
        .toContain("click:desktop");
      expect(await body!.evaluate((element) => element === document.body)).toBe(
        true,
      );
      expect(await page.evaluate(() => window.readiness.mounts)).toBe(2);
      expect(await page.evaluate(() => window.readiness.events)).not.toContain(
        "error",
      );
      await expect(page.locator("[data-mokly-label-layer] button")).toHaveCount(
        1,
      );
    });
  }
}
