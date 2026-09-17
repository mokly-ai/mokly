import path from "node:path";

import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { build } from "esbuild";

import type { CatalogueReadModel } from "../../packages/viewer/src/catalogue/types.js";
import type {} from "../../packages/viewer/tests/evidence_entry.js";

import { crossOriginFixture } from "./frame_adapter_fixture.js";

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

async function start(page: Page, cross: boolean, sibling = false) {
  await page.goto(fixture.host.url);
  await page.addScriptTag({ url: `${fixture.host.url}/evidence.js` });
  await page.evaluate(
    ({ model, origin, cross, sibling }) =>
      window.startEvidence(
        JSON.parse(model) as CatalogueReadModel,
        origin,
        cross,
        sibling ? "pending" : "ready",
      ),
    {
      model: JSON.stringify(fixture.catalogue),
      origin: fixture.frames.url,
      cross,
      sibling,
    },
  );
  await page
    .frameLocator('iframe[data-workspace-frame="desktop"]')
    .getByRole("button", { name: "Visible", exact: true })
    .waitFor();
}

async function presentation(page: Page, cross: boolean, count: number) {
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

for (const cross of [false, true]) {
  const name = cross ? "postMessage" : "same-origin";
  test(`${name} ready evidence restores active pick on retained frames`, async ({
    page,
  }) => {
    await start(page, cross);
    await page.evaluate(() => window.evidence.frames.startPick());
    await presentation(page, cross, 2);
    const body = await page
      .frameLocator('iframe[data-workspace-frame="mobile"]')
      .locator("body")
      .elementHandle();
    await page.evaluate(() => {
      window.evidence.update("mobile");
      window.evidence.update("desktop");
    });
    await expect
      .poll(() => page.evaluate(() => window.evidence.updates))
      .toBe(2);
    await presentation(page, cross, 2);
    expect(await body!.evaluate((element) => element === document.body)).toBe(
      true,
    );
    expect(await page.evaluate(() => window.evidence.mounts)).toBe(2);
    await page.evaluate(() => window.evidence.frames.startPick());
    expect(await page.evaluate(() => window.evidence.events)).toEqual([
      "start",
    ]);
    await page.locator("[data-mokly-label-layer] button").first().click();
    expect(await page.evaluate(() => window.evidence.events)).toEqual([
      "start",
      "click:mobile",
      "end:selected",
    ]);
    await page.evaluate(() => window.evidence.frames.startPick());
    await presentation(page, cross, 2);
  });

  for (const pending of [false, true]) {
    test(`${name} evidence restores scoped highlight with ${pending ? "pending" : "ready"} sibling`, async ({
      page,
    }) => {
      await start(page, cross, pending);
      await page.evaluate(async () => {
        const probe = window.evidence;
        await probe.frames.highlight(probe.instance);
        probe.calls.length = 0;
        probe.update("mobile");
      });
      await expect
        .poll(() => page.evaluate(() => window.evidence.updates))
        .toBe(1);
      await presentation(page, cross, 1);
      expect(
        await page.evaluate(() =>
          window.evidence.calls.filter(
            (call) => call.startsWith("desktop:") && call !== "desktop:off",
          ),
        ),
      ).toEqual([]);
      const label = await page
        .locator("[data-mokly-label-layer] button")
        .elementHandle();
      await page.evaluate(
        (pending) =>
          window.evidence.update("desktop", pending ? "pending" : "ready"),
        pending,
      );
      await expect
        .poll(() => page.evaluate(() => window.evidence.updates))
        .toBe(2);
      await presentation(page, cross, 1);
      expect(await label!.evaluate((element) => element.isConnected)).toBe(
        true,
      );
      expect(await page.evaluate(() => window.evidence.events)).toEqual([]);
    });
  }

  for (const evidence of ["empty", "pending", "unavailable"] as const) {
    test(`${name} ${evidence} evidence ends invalid pick once and allows restart`, async ({
      page,
    }) => {
      await start(page, cross);
      await page.evaluate(async (evidence) => {
        const probe = window.evidence;
        await probe.frames.startPick();
        probe.update("mobile", evidence);
      }, evidence);
      await expect
        .poll(() => page.evaluate(() => window.evidence.updates))
        .toBe(1);
      await presentation(page, cross, 0);
      expect(await page.evaluate(() => window.evidence.events)).toEqual([
        "start",
        "end:evidence",
      ]);
      await page.evaluate(async () => {
        const probe = window.evidence;
        probe.frames.end({ reason: "cancelled" });
        probe.update("mobile");
        await probe.frames.startPick();
      });
      await presentation(page, cross, 2);
      expect(await page.evaluate(() => window.evidence.events)).toEqual([
        "start",
        "end:evidence",
        "start",
      ]);
      expect(await page.evaluate(() => window.evidence.mounts)).toBe(2);
    });
  }

  test(`${name} removed explicit target clears labels and permits picking`, async ({
    page,
  }) => {
    await start(page, cross);
    await page.evaluate(async () => {
      const probe = window.evidence;
      await probe.frames.highlight(probe.instance);
      probe.update("mobile", "empty");
    });
    await expect
      .poll(() => page.evaluate(() => window.evidence.updates))
      .toBe(1);
    await presentation(page, cross, 0);
    expect(await page.evaluate(() => window.evidence.events)).toEqual([]);
    await page.evaluate(async () => {
      window.evidence.update("mobile");
      await window.evidence.frames.startPick();
    });
    await presentation(page, cross, 2);
    expect(await page.evaluate(() => window.evidence.events)).toEqual([
      "start",
    ]);
  });

  test(`${name} one lost multi-highlight ref clears every frame and still ends a later pick`, async ({
    page,
  }) => {
    await start(page, cross);
    await page.evaluate(() =>
      window.evidence.frames.highlightInstances(window.evidence.instances),
    );
    await presentation(page, cross, 2);
    await page.evaluate(() => window.evidence.update("mobile", "empty"));
    await expect
      .poll(() => page.evaluate(() => window.evidence.updates))
      .toBe(1);
    await presentation(page, cross, 0);
    expect(await page.evaluate(() => window.evidence.events)).toEqual([]);
    await page.evaluate(async () => {
      window.evidence.update("mobile");
      await window.evidence.frames.startPick();
      window.evidence.update("desktop", "empty");
    });
    await expect
      .poll(() => page.evaluate(() => window.evidence.updates))
      .toBe(3);
    await presentation(page, cross, 0);
    expect(await page.evaluate(() => window.evidence.events)).toEqual([
      "start",
      "end:evidence",
    ]);
  });

  for (const hold of ["highlight", "list"] as const) {
    test(`${name} evidence cancels pending ${hold} activation without events`, async ({
      page,
    }) => {
      await start(page, cross);
      await page.evaluate((hold) => {
        const probe = window.evidence;
        probe.hold = hold;
        probe.geometryDuringHighlight = hold === "list";
        void probe.frames.startPick().then(
          () => {
            probe.outcome = "resolved";
          },
          (error: unknown) => {
            probe.outcome =
              error instanceof Error && "code" in error
                ? String(error.code)
                : "failed";
          },
        );
      }, hold);
      await page.waitForFunction(() => window.evidence.waiting);
      await page.evaluate(async (hold) => {
        if (hold === "list") {
          await new Promise(requestAnimationFrame);
          await new Promise(requestAnimationFrame);
        }
        window.evidence.update("mobile");
      }, hold);
      await expect
        .poll(() => page.evaluate(() => window.evidence.outcome))
        .toBe("disposed");
      await presentation(page, cross, 0);
      expect(await page.evaluate(() => window.evidence.events)).toEqual([]);
      await page.evaluate(() => window.evidence.frames.startPick());
      await presentation(page, cross, 2);
      await page.evaluate(async () => {
        window.evidence.release();
        await new Promise(requestAnimationFrame);
        await new Promise(requestAnimationFrame);
      });
      await presentation(page, cross, 2);
      expect(await page.evaluate(() => window.evidence.events)).toEqual([
        "start",
      ]);
    });
  }
}
