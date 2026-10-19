/**
 * Light-only previous versions in Serve: a removed screen captured in Light
 * only falls back under Dark with a Light only label, and a removed document
 * from a light-only base keeps its light version and names that only under
 * Dark, at both window widths.
 */

import { expect } from "@playwright/test";

import { git } from "../helpers/static_changes.js";
import {
  addViewerStateSources,
  viewerStatePaths,
} from "../helpers/viewer_state_sources.js";

import { joinFixtureHistory } from "./serve_comparison_git.js";
import { test } from "./serve_comparison_test.js";
import { PANE_SOURCE } from "./serve_comparison_ui.js";
import { chooseScheme, chooseViewport } from "./workspace_actions.js";

test.use({ comparisonSources: { add: addViewerStateSources } });

const stage = "[data-mokly-preview]";

test("Dark falls back to the light views a screen kept only", async ({
  page,
  changes,
}) => {
  const faded = viewerStatePaths.lightOnlyRemoved;
  const record = (await changes.index()).removedEntries.find(
    ({ entry }) => entry.path === faded,
  )!;
  await page.goto(`/view/${faded}/?snapshot=${record.snapshotId}`);
  await chooseViewport(page, "desktop");
  await chooseScheme(page, "dark");
  await expect(
    page.locator(`${stage} .mbk-frame-desktop[data-color-scheme-fallback]`),
  ).toHaveCount(1);
  await expect(page.locator(`${stage} .mbk-frame-label`)).toHaveText(
    "Desktop — Light only",
  );
  await expect(
    page.locator(`${stage} .mbk-frame-desktop iframe`),
  ).toHaveAttribute(
    PANE_SOURCE,
    new RegExp(`/${faded}/index\\.desktop\\.html$`, "u"),
  );
  await expect(
    page.frameLocator(`${stage} .mbk-frame-desktop iframe`).locator("h1"),
  ).toHaveText("Faded screen");
});

for (const width of [390, 1280])
  test(`${width}px: a removed document with no dark render keeps its light version and names it only under Dark`, async ({
    page,
    changes,
  }) => {
    // A base whose catalogue had no Dark scheme captured the document in Light only.
    const config = JSON.parse(
      await git(
        changes.root,
        "show",
        `${changes.baseCommit}:mokly.config.json`,
      ),
    ) as {
      colorSchemes: string[];
      stylesheets: { darkStylesheets?: string[] }[];
    };
    config.colorSchemes = ["light"];
    for (const rule of config.stylesheets) delete rule.darkStylesheets;
    const lightBase = await changes.commitBase({
      "mokly.config.json": JSON.stringify(config),
    });
    await joinFixtureHistory(changes.root, lightBase);
    const index = await changes.moveBase(lightBase);
    const record = index.removedEntries.find(
      ({ entry }) => entry.path === changes.paths.removedDocument,
    )!;
    expect(record.entry.kind).toBe("document");

    await page.setViewportSize({ width, height: 900 });
    await page.goto(
      `/view/${record.entry.path}/?snapshot=${record.snapshotId}`,
    );
    const appearance = page.getByLabel("Appearance", { exact: true });
    const label = page.locator(".mbk-previous");
    const note = label.locator(".mbk-frame-scheme-note");
    const embed = page.locator(".mbk-stage-embed[data-preview-color-scheme]");
    const heading = page
      .frameLocator("iframe[data-mokly-preview-frame]")
      .getByRole("heading", { name: "Historical document", exact: true });

    await appearance.selectOption("light");
    await expect(heading).toBeVisible();
    await expect(label).toHaveText(/^Showing previous version/u);
    await expect(note).toBeHidden();
    await expect(page.locator(".mbk-scheme-fallback")).toHaveCount(0);

    await appearance.selectOption("dark");
    await expect(note).toBeVisible();
    await expect(label).toHaveText("Showing previous version — Light only");
    await expect(embed).toHaveAttribute("data-preview-color-scheme", "light");
    await expect(heading).toBeVisible();

    await appearance.selectOption("light");
    await expect(note).toBeHidden();
    await expect(heading).toBeVisible();
  });
