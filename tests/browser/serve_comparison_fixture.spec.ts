import { expect } from "@playwright/test";

import { readEntryDetail } from "../../packages/viewer/src/catalogue/detail_reader.js";
import type { ReviewResultV8 } from "../../packages/viewer/src/generated/catalogue/ReviewResultV8.js";

import { expectComparisonFixture } from "./comparison_fixture_membership.js";
import { expectMovedInputs } from "./moved_fixture_assertions.js";
import { test } from "./serve_comparison_test.js";

test("shared Serve comparison fixture publishes a private pinned base and CSS evidence", async ({
  page,
  request,
  changes,
}) => {
  const index = await changes.index();
  expect(index.base).toBe("fixture-base");
  expect(index.changesStatus).toBe("ready");
  expect(index.live?.generation).toBeTruthy();
  const review = (await (
    await request.get(new URL(index.comparisonUrl!, changes.url).href)
  ).json()) as ReviewResultV8;
  expect(review.baseCommit).toBe(changes.baseCommit);
  expect(changes.headCommit).not.toBe(changes.baseCommit);
  const detail = readEntryDetail(
    await (
      await request.get(`/mokly-viewer/entries/${changes.paths.changed}.json`)
    ).json(),
  );
  expect(detail.revision).toBe(index.revision);
  expect(detail.views[0]!.resourceEvidence?.rules).toContainEqual({
    stylesheet: "static/mokly-generated/styles/theme.css",
    selector: ".accent",
    status: "matched",
    owner: { kind: "entry" },
  });
  const entry = review.entries.find(
    (item) => item.path === changes.paths.changed,
  )!;
  expect(entry.included).toBe(true);
  expect(entry.views[0]!.rules).toEqual(
    detail.views[0]!.resourceEvidence!.rules,
  );
  await page.goto(`/view/${changes.paths.changed}/?viewport=desktop`);
  await expect(page.locator('[data-changes-status="ready"]')).toBeVisible();
  await expect(
    page.frameLocator('iframe[data-workspace-frame="desktop"]').locator("h1"),
  ).toHaveText("After screen");
});

test("shared Serve comparison fixture retains moved counterparts and removed membership", async ({
  request,
  changes,
}) => {
  const index = await changes.index();
  const paths = changes.paths;
  expectComparisonFixture(index);
  const current = [...index.screens, ...index.components];
  for (const [after, before] of [
    [paths.movedScreen, paths.previousScreen],
    [paths.movedConsumer, paths.previousConsumer],
    [paths.movedChild, paths.previousChild],
    [paths.movedVariant, paths.previousVariant],
  ]) {
    expect(current.find((entry) => entry.path === after)?.previousPath).toBe(
      before,
    );
    expect(
      index.removedEntries.some((record) => record.entry.path === before),
    ).toBe(false);
  }
  const generation = new URL(".", new URL(index.comparisonUrl!, changes.url));
  for (const entryPath of [
    paths.removedScreen,
    paths.removedPage,
    paths.removedChild,
    paths.removedActionVariant,
    paths.removedInvoiceVariant,
  ]) {
    const removed = index.removedEntries.find(
      (record) => record.entry.path === entryPath,
    )!;
    const detail = readEntryDetail(
      await (
        await request.get(new URL(`entries/${entryPath}.json`, generation).href)
      ).json(),
    );
    expect(detail.entry.snapshotId).toBe(removed.snapshotId);
    expect(detail.entry.kind).toBe(removed.entry.kind);
  }
});

test("shared Serve comparison fixture retains affected consumers and moved nested inputs", async ({
  request,
  changes,
}) => {
  await expectMovedInputs(request, changes.url);
  const card = readEntryDetail(
    await (
      await request.get(`/mokly-viewer/entries/${changes.paths.component}.json`)
    ).json(),
  );
  expect(card.workspace!.affected.map((link) => link.entryPath)).toContain(
    changes.paths.consumer,
  );
  const consumer = readEntryDetail(
    await (
      await request.get(`/mokly-viewer/entries/${changes.paths.consumer}.json`)
    ).json(),
  );
  expect(
    consumer.workspace!.relatedComponents.map((component) => component.path),
  ).toContain(changes.paths.component);
});
