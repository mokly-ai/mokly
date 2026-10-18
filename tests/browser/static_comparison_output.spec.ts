import fs from "node:fs/promises";
import path from "node:path";

import { expect } from "@playwright/test";

import {
  comparisonPaths,
  copiedComparisonDirectory,
  test,
} from "./comparison_test.js";

test("the native comparison copy remains usable after its two-commit source repository is removed", async ({
  request,
  baseURL,
}) => {
  const directory = copiedComparisonDirectory();
  expect(await fs.readdir(path.dirname(directory))).toEqual(["isolated"]);
  const index = await (
    await request.get(`${baseURL}/mokly-viewer/index.json`)
  ).json();
  expect(index.changesStatus).toBe("ready");
  expect(index.base).toBe("fixture-base");
  expect(index.comparisonUrl).toMatch(
    /\/generations\/[a-f0-9]{64}\/review\.json$/,
  );
  const review = await (
    await request.get(new URL(index.comparisonUrl, baseURL).href)
  ).json();
  expect(review.baseCommit).toMatch(/^[a-f0-9]{40}$/);
  expect(
    index.screens.find(
      (entry: { path: string }) => entry.path === comparisonPaths.unchanged,
    ).changes,
  ).toEqual({ included: false, kind: "unmodified", status: "ready" });
  expect(
    index.removedEntries
      .map((record: { entry: { path: string } }) => record.entry.path)
      .sort(),
  ).toEqual(
    [
      comparisonPaths.removedComponent,
      comparisonPaths.removedDocument,
      comparisonPaths.removedPage,
      comparisonPaths.removedScreen,
      comparisonPaths.removedVariant,
      comparisonPaths.quietRemoved,
    ].sort(),
  );
  // The comparison UI specs rely on each entry's classification.
  const changes = Object.fromEntries(
    [...index.screens, ...index.components].map(
      (entry: { path: string; changes: unknown }) => [
        entry.path,
        entry.changes,
      ],
    ),
  );
  const state = (included: boolean, kind: string) => ({
    included,
    kind,
    status: "ready",
  });
  expect(changes).toEqual({
    [comparisonPaths.added]: state(true, "added"),
    [comparisonPaths.changed]: state(true, "changed"),
    [comparisonPaths.consumer]: state(false, "unmodified"),
    [comparisonPaths.darkOnly]: state(true, "changed"),
    [comparisonPaths.unchanged]: state(false, "unmodified"),
    [comparisonPaths.component]: state(true, "changed"),
    [comparisonPaths.changedVariant]: state(true, "changed"),
    [comparisonPaths.addedVariant]: state(true, "added"),
    [comparisonPaths.quietParent]: state(false, "unmodified"),
    [comparisonPaths.quietSibling]: state(false, "unmodified"),
    [comparisonPaths.quietVariant]: state(true, "changed"),
  });
  const dusk = index.screens.find(
    (entry: { path: string }) => entry.path === comparisonPaths.darkOnly,
  );
  expect(
    dusk.views.map(
      (view: { colorScheme: string; comparison: { kind: string } }) =>
        `${view.colorScheme}:${view.comparison.kind}`,
    ),
  ).toEqual([
    "light:unmodified",
    "dark:changed",
    "light:unmodified",
    "dark:changed",
  ]);
  for (const source of [
    ".git/HEAD",
    "mokly.config.json",
    "specs/screens/changed.screen.html",
  ])
    expect((await request.get(`${baseURL}/${source}`)).status()).toBe(404);
});
