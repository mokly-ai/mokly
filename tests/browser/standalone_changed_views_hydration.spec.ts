import { expect, test } from "@playwright/test";

import { darkOnlyScreenViews } from "../helpers/changed_view_fixture.js";
import { startEvidenceFixture } from "../helpers/evidence_fixture.js";

import {
  buildDevelopmentBundle,
  captureBrowserErrors,
  expectCleanHydration,
  installDevelopmentBundle,
} from "./react_shell_hydration_helpers.js";
import { expectFrameSource } from "./workspace_actions.js";

const home = "screens/home.html";

test("restored Dark hydrates the active workspace's changed-view evidence", async ({
  page,
}) => {
  const fixture = await startEvidenceFixture();
  try {
    fixture.server.publishUpdate({
      kind: "evidence",
      changedRoutes: [home],
      changesStatus: "ready",
      componentChanges: {
        baseline: fixture.compilation.manifest,
        screenViews: darkOnlyScreenViews(),
      },
    });
    const errors = captureBrowserErrors(page);
    await page.addInitScript(() => localStorage.setItem("mokly:theme", "dark"));
    await installDevelopmentBundle(page, await buildDevelopmentBundle());
    await page.goto(`${fixture.server.url}/view/${home}`);
    await expectCleanHydration(page, errors);
    await expect(page.getByLabel("Appearance", { exact: true })).toHaveValue(
      "dark",
    );
    await expect(page.locator('[data-view-changed="scheme"]')).toBeHidden();
    await expect(page.locator("[data-workspace-status]")).toHaveText("Changed");
  } finally {
    await fixture.close();
  }
});

test("Changes navigation respects a reader's Light choice and clears route evidence", async ({
  page,
}) => {
  const fixture = await startEvidenceFixture();
  try {
    fixture.server.publishUpdate({
      kind: "evidence",
      changedRoutes: [home],
      changesStatus: "ready",
      componentChanges: {
        baseline: fixture.compilation.manifest,
        screenViews: darkOnlyScreenViews(),
      },
    });
    await page.goto(`${fixture.server.url}/view/screens/details.html`);
    await page.getByLabel("Appearance", { exact: true }).selectOption("light");
    await page.locator('[data-filter="changed"]').click();
    await page.locator(`a[data-nav-row][data-route="${home}"]`).click();
    await expect(page.getByLabel("Appearance", { exact: true })).toHaveValue(
      "light",
    );
    await expect(page.locator("body")).toHaveAttribute(
      "data-mokly-color-scheme",
      "light",
    );
    await expectFrameSource(
      page.locator('[data-workspace-frame="mobile"]'),
      /home\.mobile\.html$/,
    );
    await expect(
      page.locator('.mbk-appearance [data-view-changed="scheme"]'),
    ).toBeVisible();
    await page.locator(".mbk-brand").click();
    await expect(page.locator('[data-view-changed="scheme"]')).toBeHidden();
    await expect(
      page.getByLabel("Appearance", { exact: true }),
    ).not.toHaveAttribute("aria-describedby");
  } finally {
    await fixture.close();
  }
});
