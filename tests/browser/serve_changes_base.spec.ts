import { expect } from "@playwright/test";

import { hasMarker, markPage } from "./browse_assertions.js";
import { test } from "./browser_test.js";
import { serveChanges } from "./serve_changes_fixture.js";

test("native base-ref changes reclassify the accepted head without a page reload", async ({
  page,
}) => {
  const fixture = await serveChanges();
  try {
    const first = await fixture.index();
    const key = first.screens.find((entry) => entry.path === "sample")!
      .views[0]!.documentKey;
    const original = (
      await fixture.git("rev-parse", "fixture-base")
    ).stdout.trim();
    await page.goto(`${fixture.url}/view/sample/`);
    await markPage(page);
    await fixture.git("add", ".");
    await fixture.git("commit", "-m", "fixture: current catalogue");
    await fixture.git("update-ref", "refs/heads/fixture-base", "HEAD");
    await expect
      .poll(
        async () => {
          const next = await fixture.index();
          return (
            next.changesStatus === "ready" &&
            next.removedEntries.length === 0 &&
            next.screens.every(
              (entry) =>
                entry.changes.status === "ready" && !entry.changes.included,
            )
          );
        },
        { timeout: 30_000 },
      )
      .toBe(true);
    const settled = await fixture.index();
    expect(
      settled.screens.find((entry) => entry.path === "sample")!.views[0]!
        .documentKey,
    ).toBe(key);
    expect(settled.live).toEqual(first.live);
    expect(await hasMarker(page)).toBe(true);
    await fixture.git("update-ref", "-d", "refs/heads/fixture-base");
    await expect
      .poll(async () => (await fixture.index()).changesStatus, {
        timeout: 30_000,
      })
      .toBe("unavailable");
    expect(
      (
        await page.request.get(
          `${fixture.url}/static/mokly-generated/sample/index.mobile.html`,
        )
      ).ok(),
    ).toBe(true);
    const unavailable = await fixture.index();
    expect(unavailable.comparisonUrl).toBeNull();
    expect(unavailable.removedEntries).toEqual([]);
    await fixture.git("update-ref", "refs/heads/fixture-base", original);
    const restored = await fixture.ready(unavailable.revision);
    expect(restored.removedEntries).toHaveLength(2);
    expect(restored.live).toEqual(first.live);
  } finally {
    await fixture.close();
  }
});
