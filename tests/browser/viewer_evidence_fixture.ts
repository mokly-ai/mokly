import path from "node:path";

import { expect } from "@playwright/test";
import type { Page } from "@playwright/test";
import { build } from "esbuild";

import type { CatalogueReadModel } from "../../packages/viewer/src/catalogue/types.js";

import type {} from "../../packages/viewer/tests/evidence_entry.js";

import { test } from "./browser_test.js";
import { crossOriginFixture } from "./frame_adapter_fixture.js";

/** Each importing spec registers its own server lifecycle and start closure. */
export function evidenceFixture() {
  let fixture: Awaited<ReturnType<typeof crossOriginFixture>>;
  test.beforeAll(async () => {
    fixture = await crossOriginFixture({
      body: '<action.Component label="Visible" />',
    });
    await build({
      entryPoints: ["packages/viewer/tests/evidence_entry.ts"],
      outfile: path.join(fixture.root, "evidence.js"),
      bundle: true,
      platform: "browser",
      format: "iife",
      target: "es2023",
      logLevel: "silent",
    });
  });
  test.afterAll(async () => fixture?.close());

  return async function start(page: Page, cross: boolean, sibling = false) {
    await page.goto(fixture.host.url);
    await page.addScriptTag({ url: `${fixture.host.url}/evidence.js` });
    await page.evaluate(
      ({ model, details, origin, cross, sibling }) =>
        window.startEvidence(
          JSON.parse(model) as CatalogueReadModel,
          JSON.parse(details),
          origin,
          cross,
          sibling ? "pending" : "ready",
        ),
      {
        model: JSON.stringify(fixture.index),
        details: JSON.stringify(
          Object.entries(fixture.details.current).map(([path, detail]) => [
            { path },
            detail,
          ]),
        ),
        origin: fixture.frames.url,
        cross,
        sibling,
      },
    );
    await page
      .frameLocator('iframe[data-workspace-frame="desktop"]')
      .getByRole("button", { name: "Visible", exact: true })
      .waitFor();
  };
}

export async function presentation(page: Page, cross: boolean, count: number) {
  await expect(page.locator("[data-mokly-label-layer] button")).toHaveCount(
    count,
  );
  if (cross) {
    for (const [index, viewport] of ["mobile", "desktop"].entries()) {
      const overlay = page
        .frameLocator(`iframe[data-workspace-frame="${viewport}"]`)
        .locator("[data-mokly-overlay]");
      await expect(overlay).toHaveCount(index < count ? 1 : 0);
      if (index < count)
        await expect(overlay.locator("rect[stroke]")).not.toHaveCount(0);
    }
  } else {
    const overlays = page.locator(".mbk-highlight-layer");
    await expect(overlays).toHaveCount(count);
    for (let index = 0; index < count; index++) {
      await expect(overlays.nth(index)).toHaveAttribute(
        "data-highlight-viewport",
        index === 0 ? "mobile" : "desktop",
      );
      await expect(overlays.nth(index).locator("rect[stroke]")).not.toHaveCount(
        0,
      );
    }
  }
}
