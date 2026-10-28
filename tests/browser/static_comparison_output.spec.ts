import fs from "node:fs/promises";
import path from "node:path";

import { expect } from "@playwright/test";

import {
  comparisonPaths,
  copiedComparisonDirectory,
  test,
} from "./comparison_test.js";

test("the native comparison copy remains usable after its two-commit source repository is removed", async ({
  page,
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
  expect(index.comparisonUrl).toMatch(/\/generations\/[a-f0-9]{64}\/$/);
  expect(index.baseCommit).toMatch(/^[a-f0-9]{40}$/);
  const parentDetail = (await (
    await request.get(
      `${baseURL}/mokly-viewer/entries/${comparisonPaths.component}.json`,
    )
  ).json()) as {
    workspace?: { usedBy?: unknown[]; affected?: unknown[] };
  };
  const variantDetail = (await (
    await request.get(
      `${baseURL}/mokly-viewer/entries/${comparisonPaths.changedVariant}.json`,
    )
  ).json()) as {
    workspace?: { usedBy?: unknown[]; affected?: unknown[] };
  };
  expect(parentDetail.workspace?.usedBy).toBeDefined();
  expect(variantDetail.workspace?.usedBy).toBeUndefined();
  expect(variantDetail.workspace?.affected).toBeUndefined();
  const removed = index.removedEntries.find(
    (record: { entry: { path: string } }) =>
      record.entry.path === comparisonPaths.removedVariant,
  )! as { snapshotId: string };
  const removedDetail = (await (
    await request.get(
      `${baseURL}/${index.comparisonUrl}entries/${comparisonPaths.removedVariant}.json`,
    )
  ).json()) as {
    workspace?: { usedBy?: unknown[]; affected?: unknown[] };
  };
  expect(removed.snapshotId).toMatch(/^[a-f0-9]{64}$/u);
  expect(removedDetail.workspace?.usedBy).toEqual([]);
  expect(removedDetail.workspace?.affected).toEqual(
    parentDetail.workspace?.affected,
  );
  await page.goto(`/view/${comparisonPaths.changedVariant}/`);
  await page.getByRole("tab", { name: "Usage", exact: true }).click();
  const usage = page.getByRole("tabpanel", { name: "Usage", exact: true });
  await expect(
    usage.locator('[data-usage-section="used-by"]').getByRole("link"),
  ).toHaveText(["Toolbar", "Changed screen", "Consumer screen"]);

  const parentRequests: string[] = [];
  page.on("request", (request) => {
    if (request.url().includes("/entries/components/card.json"))
      parentRequests.push(request.url());
  });
  await page.goto(
    `/view/${comparisonPaths.removedVariant}/?snapshot=${removed.snapshotId}`,
  );
  await expect(
    page.getByRole("tab", { name: "Usage", exact: true }),
  ).toBeVisible();
  await page.getByRole("tab", { name: "Usage", exact: true }).click();
  const removedUsage = page.getByRole("tabpanel", {
    name: "Usage",
    exact: true,
  });
  await expect(
    removedUsage.getByRole("heading", { name: "Used by" }),
  ).toBeVisible();
  await expect(removedUsage).toContainText("No recorded consumers.");
  await expect(
    removedUsage.getByRole("heading", {
      name: "Affected screens and components",
    }),
  ).toBeVisible();
  expect(parentRequests).toEqual([]);
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
      comparisonPaths.removedLightOnly,
      comparisonPaths.screenRemovedVariant,
      comparisonPaths.removedVariant,
      comparisonPaths.quietRemoved,
    ].sort(),
  );
  // The comparison UI specs rely on each entry's classification.
  const changes = Object.fromEntries(
    [...index.screens, ...index.components, ...index.pages].map(
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
    [comparisonPaths.lightOnly]: state(true, "changed"),
    [comparisonPaths.screenParent]: state(false, "unmodified"),
    [comparisonPaths.screenVariant]: state(true, "changed"),
    [comparisonPaths.screenSibling]: state(false, "unmodified"),
    [comparisonPaths.folderIndex]: state(false, "unmodified"),
    [comparisonPaths.folderChanged]: state(true, "changed"),
    [comparisonPaths.folderQuiet]: state(false, "unmodified"),
    [comparisonPaths.plainScreen]: state(false, "unmodified"),
    [comparisonPaths.plainComponent]: state(false, "unmodified"),
    [comparisonPaths.lightOnlyParent]: state(false, "unmodified"),
    [comparisonPaths.lightOnlyVariant]: state(true, "changed"),
    [comparisonPaths.atRuleChange]: state(true, "changed"),
    [comparisonPaths.mobileOnlyChange]: state(true, "changed"),
    [comparisonPaths.tall]: state(true, "changed"),
    [comparisonPaths.appShell]: state(true, "changed"),
    [comparisonPaths.regionsShell]: state(true, "changed"),
    [comparisonPaths.regionsPage]: state(true, "changed"),
    [comparisonPaths.taskList]: state(false, "unmodified"),
    [comparisonPaths.taskListVariant]: state(true, "changed"),
    [comparisonPaths.unchanged]: state(false, "unmodified"),
    [comparisonPaths.component]: state(true, "changed"),
    [comparisonPaths.changedVariant]: state(true, "changed"),
    [comparisonPaths.addedVariant]: state(true, "added"),
    [comparisonPaths.quietParent]: state(false, "unmodified"),
    [comparisonPaths.quietSibling]: state(false, "unmodified"),
    [comparisonPaths.quietVariant]: state(true, "changed"),
    [comparisonPaths.pageComponent]: state(true, "changed"),
    [comparisonPaths.consumingComponent]: state(false, "unmodified"),
    [comparisonPaths.changedPage]: state(true, "changed"),
    [comparisonPaths.unchangedPage]: state(false, "unmodified"),
    [comparisonPaths.similarTextPage]: state(true, "changed"),
    [comparisonPaths.componentPage]: state(false, "unmodified"),
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
