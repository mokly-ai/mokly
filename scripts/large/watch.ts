/** Edit-to-publication and visible reload observations on one browser clock. */
import { expect } from "@playwright/test";
import type { BrowserContext, Frame, Page } from "@playwright/test";

import { changesSummary, firstScreen } from "./changes.js";
import {
  changedEntries,
  changesVisible,
  delivered,
  observeDelivery,
} from "./delivery.js";
import type { PreparedFixture } from "./setup.js";
import { fixtureEdits, withFixtureEdit } from "./watch_edits.js";

type Edit = Awaited<ReturnType<typeof fixtureEdits>>[number];
export type WatchMeasurement = Awaited<ReturnType<typeof measureEdit>>;
export const WATCH_BROWSER_TIMEOUT_MS = 1_800_000;

async function measureEdit(
  page: Page,
  fixture: PreparedFixture,
  edit: Edit,
  before: Awaited<ReturnType<typeof delivered>>,
  beginning: number,
  navigationCount: () => number,
) {
  const fence = {
    afterRevision: before.index.revision,
    previousGeneration: before.index.live!.generation,
  };
  const [publication, frameReloadMs] = await Promise.all([
    delivered(page, {
      ...fence,
      ready: false,
      timeoutMs: WATCH_BROWSER_TIMEOUT_MS,
    }),
    (async () => {
      await edit.verify(page, true);
      await expect
        .poll(navigationCount, { timeout: WATCH_BROWSER_TIMEOUT_MS })
        .toBeGreaterThan(0);
      return page.evaluate((start) => performance.now() - start, beginning);
    })(),
  ]);
  const ready = await delivered(page, {
    ...fence,
    timeoutMs: WATCH_BROWSER_TIMEOUT_MS,
  });
  await changesVisible(page, ready.index, WATCH_BROWSER_TIMEOUT_MS);
  const changesReadyMs = await page.evaluate(
    (start) => performance.now() - start,
    beginning,
  );
  const summary = changesSummary(fixture, ready);
  if (!changedEntries(ready.index).some((entry) => entry.path === edit.target))
    throw new Error(`Changes did not include ${edit.target}`);
  return {
    kind: edit.kind,
    file: edit.file,
    beforeRevision: before.index.revision,
    previousGeneration: fence.previousGeneration,
    generation: ready.index.live!.generation,
    publicationRevision: publication.publication.revision,
    indexRevision: publication.index.revision,
    changesRevision: ready.index.revision,
    publicationMs: publication.publication.receivedMs - beginning,
    frameNavigations: navigationCount(),
    frameReloadMs,
    indexReadyMs: ready.indexReceivedMs - beginning,
    changesReadyMs,
    summary,
    changedEntries: changedEntries(ready.index).length,
  };
}

export async function watch(
  context: BrowserContext,
  url: string,
  fixture: PreparedFixture,
  edits: WatchMeasurement[],
) {
  const page = await context.newPage();
  await observeDelivery(page);
  await page.goto(`${url}/view/${firstScreen}/`);
  await page.getByLabel("Viewport", { exact: true }).selectOption("desktop");
  for (const edit of await fixtureEdits(fixture, WATCH_BROWSER_TIMEOUT_MS)) {
    await edit.verify(page, false);
    const before = await delivered(page, {
      timeoutMs: WATCH_BROWSER_TIMEOUT_MS,
    });
    if (!before.index.live) throw new Error("Watch needs a live generation");
    const frame = page.locator('[data-workspace-frame="desktop"]');
    const previousSrc = await frame.getAttribute("src");
    if (!previousSrc) throw new Error("Watch preview has no source URL");
    let navigations = 0;
    const previewPath = new URL(previousSrc, url).pathname;
    const navigated = (frame: Frame) => {
      if (
        frame.parentFrame() === page.mainFrame() &&
        new URL(frame.url()).pathname === previewPath
      )
        navigations++;
    };
    page.on("framenavigated", navigated);
    const beginning = await page.evaluate(() => performance.now());
    try {
      await withFixtureEdit(edit, async () => {
        edits.push(
          await measureEdit(
            page,
            fixture,
            edit,
            before,
            beginning,
            () => navigations,
          ),
        );
      });
    } finally {
      page.off("framenavigated", navigated);
    }
    const measured = edits.at(-1)!;
    await edit.verify(page, false);
    const restored = await delivered(page, {
      afterRevision: measured.changesRevision,
      previousGeneration: measured.generation,
      timeoutMs: WATCH_BROWSER_TIMEOUT_MS,
    });
    await changesVisible(page, restored.index, WATCH_BROWSER_TIMEOUT_MS);
    if (changedEntries(restored.index).length)
      throw new Error(`Restoring ${edit.file} left Changes`);
  }
  return {
    edits,
    clock:
      "Browser monotonic clock; starts immediately before requesting the file write. Includes driver dispatch.",
  };
}
