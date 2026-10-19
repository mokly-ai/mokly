import { expect } from "@playwright/test";

import { test } from "./serve_comparison_test.js";

test("shared Serve comparison fixture renews selected generations after a watched edit", async ({
  request,
  changes,
}) => {
  const selected = `/mokly-viewer/diffs/review.json?path=${changes.paths.changed}`;
  const initial = await request.get(selected);
  expect(initial.ok()).toBe(true);
  const before = initial
    .url()
    .replace(
      "review.json",
      `snapshots/before/mokly-generated/${changes.paths.changed}/index.desktop.html`,
    );
  const after = before.replace("/snapshots/before/", "/snapshots/after/");
  const retained = await (await request.get(after)).body();
  expect(retained.toString()).toContain("After screen");
  expect(await (await request.get(before)).text()).toContain("Before screen");
  expect((await request.head(initial.url())).ok()).toBe(true);
  const index = await changes.index();
  const next = await changes.edit(
    `specs/${changes.paths.changed}.screen.html`,
    '---\ntitle: Changed screen\n---\n<h1>Watched edit</h1><p class="accent">Changed CSS</p>',
  );
  expect(next.revision).toBeGreaterThan(index.revision);
  expect(next.live).not.toEqual(index.live);
  const renewed = await request.get(`${selected}&refresh=1`);
  expect(renewed.ok()).toBe(true);
  expect(renewed.url()).not.toBe(initial.url());
  expect((await renewed.json()).baseCommit).toBe(changes.baseCommit);
  expect(
    await (
      await request.get(
        renewed
          .url()
          .replace(
            "review.json",
            `snapshots/after/mokly-generated/${changes.paths.changed}/index.desktop.html`,
          ),
      )
    ).text(),
  ).toContain("Watched edit");
  expect(await (await request.get(after)).body()).toEqual(retained);
  expect((await request.head(initial.url())).ok()).toBe(true);
});

test("shared Serve comparison fixture can move and restore its independent base ref", async ({
  request,
  changes,
}) => {
  const initial = await changes.index();
  const originalKey = initial.screens.find(
    (entry) => entry.path === changes.paths.changed,
  )!.views[0]!.documentKey;
  const atHead = await changes.moveBase("head");
  expect(atHead.revision).toBeGreaterThan(initial.revision);
  expect(atHead.removedEntries).toEqual([]);
  expect(
    [...atHead.screens, ...atHead.components].every(
      (entry) => entry.changes.status === "ready" && !entry.changes.included,
    ),
  ).toBe(true);
  expect(
    (
      await (
        await request.get(new URL(atHead.comparisonUrl!, changes.url).href)
      ).json()
    ).baseCommit,
  ).toBe(changes.headCommit);
  expect(
    atHead.screens.find((entry) => entry.path === changes.paths.changed)!
      .views[0]!.documentKey,
  ).toBe(originalKey);
  expect(atHead.live).toEqual(initial.live);
  const restored = await changes.moveBase("base");
  expect(restored.removedEntries).toEqual(initial.removedEntries);
  expect(restored.screens.map((entry) => entry.changes)).toEqual(
    initial.screens.map((entry) => entry.changes),
  );
  expect(restored.live).toEqual(initial.live);
});
