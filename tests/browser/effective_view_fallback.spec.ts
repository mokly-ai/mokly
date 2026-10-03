import { expect, test } from "@playwright/test";

import { secondVariantDarkOnlyResult } from "../helpers/changed_view_fixture.js";
import { comparisonEntrySource } from "../helpers/comparison_source.js";
import { controlsEntrySource } from "../helpers/component_controls_fixture.js";
import { startEvidenceFixture } from "../helpers/evidence_fixture.js";

const SCHEME_DOT = '[data-view-changed="scheme"]';
const TOOLBAR = ".mbk-diff-toolbar";

test("a light-only screen deep link keeps effective Light evidence through a background update", async ({
  page,
}) => {
  const fixture = await startEvidenceFixture(comparisonEntrySource(true));
  const { compilation, server } = fixture;
  try {
    await page.goto(`${server.url}/view/details/?scheme=dark&comparison=side`);
    server.publishUpdate({
      kind: "evidence",
      changedEntries: ["details"],
      changesStatus: "ready",
      componentChanges: {
        baseline: compilation.manifest,
        screenViews: [
          {
            path: "details",
            views: [
              {
                viewport: "mobile",
                colorScheme: "light",
                state: "unchanged",
              },
              {
                viewport: "desktop",
                colorScheme: "light",
                state: "unchanged",
              },
            ],
          },
        ],
      },
    });

    await expect(page.locator("[data-workspace-status]")).toHaveText(
      "Unmodified",
    );
    await expect(page.locator(TOOLBAR)).toBeHidden();
    await expect(page.locator('[data-diff-mode="current"]')).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await expect(page.locator("[data-mokly-appearance-select]")).toHaveValue(
      "dark",
    );
    await expect(page.locator(SCHEME_DOT)).toBeHidden();
    expect(fixture.comparisonRequests).toBe(0);
  } finally {
    await fixture.close();
  }
});

test("a light-only saved variant uses its displayed scheme for status and marks", async ({
  page,
}) => {
  const source = controlsEntrySource().replace(
    'path: "action",',
    'path: "action", colorSchemes: ["light"],',
  );
  const fixture = await startEvidenceFixture(source);
  const { compilation, server } = fixture;
  const result = structuredClone(secondVariantDarkOnlyResult());
  const action = result.components[0]!;
  for (const variant of action.variants) {
    variant.views = variant.views
      .filter(({ colorScheme }) => colorScheme === "light")
      .map((view) => ({
        ...view,
        state: variant.path === "action/disabled" ? "changed" : "unchanged",
      }));
  }
  try {
    server.publishUpdate({
      kind: "evidence",
      changedEntries: [],
      changesStatus: "ready",
      componentChanges: { baseline: compilation.manifest, result },
    });
    await page.goto(`${server.url}/view/action/disabled/?scheme=dark`);

    await expect(page.locator("[data-workspace-status]")).toHaveText("Changed");
    await expect(page.locator(TOOLBAR)).toBeVisible();
    await expect(page.locator("[data-mokly-appearance-select]")).toHaveValue(
      "dark",
    );
    await expect(page.locator(SCHEME_DOT)).toBeHidden();
    for (const frame of await page.locator("[data-workspace-frame]").all())
      await expect(frame).not.toHaveAttribute("src", /\.dark\.html$/);
  } finally {
    await fixture.close();
  }
});
