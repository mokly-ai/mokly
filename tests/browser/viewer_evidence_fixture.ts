import path from "node:path";

import { expect } from "@playwright/test";
import type { Page } from "@playwright/test";
import { build } from "esbuild";

import type { CatalogueReadModel } from "../../packages/model/dist/index.js";

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

  // Every case uses the same-origin adapter: the cases check the viewer, and
  // the adapters have their own specs.
  return async function start(page: Page, sibling = false) {
    await page.goto(fixture.host.url);
    await page.addScriptTag({ url: `${fixture.host.url}/evidence.js` });
    await page.evaluate(
      ({ model, details, sibling }) =>
        window.startEvidence(
          JSON.parse(model) as CatalogueReadModel,
          JSON.parse(details),
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
        sibling,
      },
    );
    await page
      .frameLocator('iframe[data-workspace-frame="desktop"]')
      .getByRole("button", { name: "Visible", exact: true })
      .waitFor();
  };
}

export async function presentation(page: Page, count: number) {
  await expect(page.locator("[data-mokly-label-layer] button")).toHaveCount(
    count,
  );
  const overlays = page.locator(".mbk-highlight-layer");
  await expect(overlays).toHaveCount(count);
  for (let index = 0; index < count; index++) {
    await expect(overlays.nth(index)).toHaveAttribute(
      "data-highlight-viewport",
      index === 0 ? "mobile" : "desktop",
    );
    await expect(
      overlays.nth(index).locator(".mbk-highlight-outline"),
    ).not.toHaveCount(0);
  }
}
