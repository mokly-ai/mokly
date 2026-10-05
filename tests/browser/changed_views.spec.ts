import { expect, test } from "@playwright/test";

import { darkOnlyScreenViews } from "../helpers/changed_view_fixture.js";
import { startEvidenceFixture } from "../helpers/evidence_fixture.js";
import { reparentedEntrySource } from "../helpers/fixture.js";

import {
  HOME,
  HOME_PATH,
  SCHEME_DOT,
  VIEWPORT_DOT,
  dotStyle,
  expectShownStatus,
} from "./changed_view_assertions.js";
import { expectFrameSource } from "./workspace_actions.js";

test("a dark-only change marks the views it hides and opens on one", async ({
  page,
}) => {
  const fixture = await startEvidenceFixture();
  const { compilation, server } = fixture;
  try {
    server.publishUpdate({
      kind: "evidence",
      changedEntries: [HOME_PATH],
      changesStatus: "ready",
      componentChanges: {
        baseline: compilation.manifest,
        screenViews: darkOnlyScreenViews(),
      },
    });
    await page.goto(`${server.url}/view/${HOME}?comparison=side`);

    const scheme = page.getByLabel("Appearance", { exact: true });
    await expect(page.locator("body")).toHaveAttribute(
      "data-mokly-color-scheme",
      "light",
    );
    await expect(page.locator(SCHEME_DOT)).toBeVisible();
    await expect(
      page.locator(".mbk-appearance").locator(SCHEME_DOT),
    ).toBeVisible();
    await expect(scheme).toHaveAttribute(
      "aria-describedby",
      "mb-view-changed-scheme",
    );
    await expect(page.locator('[data-view-changed-text="scheme"]')).toHaveText(
      "Other theme changed",
    );
    await expect(page.locator(VIEWPORT_DOT)).toBeHidden();
    await expectShownStatus(page, "Unmodified", false);
    await expect(page.locator('[data-diff-mode="current"]')).toHaveAttribute(
      "aria-pressed",
      "true",
    );

    await scheme.selectOption("dark");
    await expect(page.locator("body")).toHaveAttribute(
      "data-mokly-color-scheme",
      "dark",
    );
    await expect(page.getByLabel("Viewport", { exact: true })).toHaveValue(
      "both",
    );
    await expectShownStatus(page, "Changed", true);

    await scheme.selectOption("light");
    await expect(page.locator("body")).toHaveAttribute(
      "data-mokly-color-scheme",
      "light",
    );
    await expectShownStatus(page, "Unmodified", false);

    expect(await dotStyle(page, SCHEME_DOT)).toEqual({
      display: "block",
      radius: "50%",
      shadow: "rgb(255, 255, 255) 0px 0px 0px 1.5px",
      width: "6px",
    });

    await page.getByRole("tab", { name: "Details", exact: true }).click();
    const row = page.locator("[data-workspace-changed-views]");
    await expect(row).toBeVisible();
    await expect(row).toHaveText("Changed viewsMobile · Dark, Desktop · Dark");

    await page.getByLabel("Viewport", { exact: true }).selectOption("mobile");
    await expect(page.locator(VIEWPORT_DOT)).toBeVisible();
    await expect(page.getByLabel("Viewport", { exact: true })).toHaveAttribute(
      "aria-describedby",
      "mb-view-changed-viewport",
    );

    await scheme.selectOption("dark");
    await expect(page.locator("body")).toHaveAttribute(
      "data-mokly-color-scheme",
      "dark",
    );
    await expect(page.locator(SCHEME_DOT)).toBeHidden();
    await expect(scheme).not.toHaveAttribute("aria-describedby", /.*/);
    await expect(page.locator(VIEWPORT_DOT)).toBeVisible();
    await expect(row).toBeVisible();

    await expectShownStatus(page, "Changed", true);
    await scheme.selectOption("light");
    await expectShownStatus(page, "Unmodified", false);

    await page.goto(
      `${server.url}/view/${HOME}?viewport=mobile&scheme=dark&comparison=side`,
    );
    await expect(page.getByLabel("Viewport", { exact: true })).toHaveValue(
      "mobile",
    );
    await expect(page.locator("body")).toHaveAttribute(
      "data-mokly-color-scheme",
      "dark",
    );
    await expectShownStatus(page, "Changed", true);
    await expect(page.locator('[data-diff-mode="side"]')).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  } finally {
    await fixture.close();
  }
});

test("a light fallback rejects an ineligible comparison deep link", async ({
  page,
}) => {
  const original = reparentedEntrySource("screens");
  const marker = 'description: "Home screen", desktop:';
  expect(original.split(marker)).toHaveLength(2);
  const source = original.replace(
    marker,
    'colorSchemes: ["light"], description: "Home screen", desktop:',
  );
  const fixture = await startEvidenceFixture(source);
  const { compilation, server } = fixture;
  try {
    server.publishUpdate({
      kind: "evidence",
      changedEntries: [HOME_PATH],
      changesStatus: "ready",
      componentChanges: {
        baseline: compilation.manifest,
        screenViews: [
          {
            path: HOME_PATH,
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
    await page.goto(
      `${server.url}/view/${HOME}?viewport=mobile&scheme=dark&comparison=side`,
    );

    await expect(page.locator("body")).toHaveAttribute(
      "data-mokly-color-scheme",
      "dark",
    );
    await expectFrameSource(
      page.locator('[data-workspace-frame="mobile"]'),
      /home\/index\.mobile\.html$/,
    );
    await expect(page.locator(".mbk-frame-mobile")).toHaveAttribute(
      "data-color-scheme-fallback",
      "",
    );
    await expectShownStatus(page, "Unmodified", false);
    await expect(page.locator('[data-diff-mode="current"]')).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(fixture.comparisonRequests).toBe(0);
  } finally {
    await fixture.close();
  }
});
