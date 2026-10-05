import { expect, test } from "@playwright/test";

import {
  darkOnlyScreenViews,
  secondVariantDarkOnlyResult,
} from "../helpers/changed_view_fixture.js";
import { controlsEntrySource } from "../helpers/component_controls_fixture.js";
import { startEvidenceFixture } from "../helpers/evidence_fixture.js";

import {
  HOME,
  HOME_PATH,
  HOME_ROW,
  SCHEME_DOT,
  VIEWPORT_DOT,
  expectShownStatus,
} from "./changed_view_assertions.js";
import { chooseVariant, expectFrameSource } from "./workspace_actions.js";

test("a background classification moves the marks without reloading the frames", async ({
  page,
}) => {
  const fixture = await startEvidenceFixture();
  const { compilation, server } = fixture;
  try {
    await page.goto(`${server.url}/view/${HOME}`);
    await page.getByRole("tab", { name: "Details", exact: true }).click();
    const row = page.locator("[data-workspace-changed-views]");
    await expect(page.locator(SCHEME_DOT)).toBeHidden();
    await expect(row).toBeHidden();
    await page
      .frameLocator('[data-workspace-frame="mobile"]')
      .locator("body")
      .evaluate((body) => body.setAttribute("data-test-retained", "true"));

    server.publishUpdate({
      kind: "evidence",
      changedEntries: [HOME_PATH],
      changesStatus: "ready",
      componentChanges: {
        baseline: compilation.manifest,
        screenViews: darkOnlyScreenViews(),
      },
    });

    await expect(page.locator(SCHEME_DOT)).toBeVisible();
    await expect(
      page.getByLabel("Appearance", { exact: true }),
    ).toHaveAttribute("aria-describedby", "mb-view-changed-scheme");
    await expect(row).toHaveText("Changed viewsMobile · Dark, Desktop · Dark");
    await expect(
      page.frameLocator('[data-workspace-frame="mobile"]').locator("body"),
    ).toHaveAttribute("data-test-retained", "true");
  } finally {
    await fixture.close();
  }
});

test("component view evidence follows the selected saved variant", async ({
  page,
}) => {
  const fixture = await startEvidenceFixture(controlsEntrySource());
  const { compilation, server } = fixture;
  try {
    server.publishUpdate({
      kind: "evidence",
      changedEntries: [],
      changesStatus: "ready",
      componentChanges: {
        baseline: compilation.manifest,
        result: secondVariantDarkOnlyResult(),
      },
    });
    await page.goto(`${server.url}/view/action/`);

    const row = page.locator("[data-workspace-changed-views]");
    const scheme = page.getByLabel("Appearance", { exact: true });
    await expect(page.locator(SCHEME_DOT)).toBeHidden();
    await expect(row).toBeHidden();
    await expectShownStatus(page, "Unmodified", false);

    await chooseVariant(page, "Disabled");

    await expect(page.locator(SCHEME_DOT)).toBeVisible();
    await expect(row).toBeVisible();
    await expect(row).toHaveText("Changed viewsMobile · Dark, Desktop · Dark");
    await expectShownStatus(page, "Unmodified", false);

    await scheme.selectOption("dark");
    await expectShownStatus(page, "Changed", true);
  } finally {
    await fixture.close();
  }
});

test("Changes lands on the first changed view and every other arrival stays sticky", async ({
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
    await page.goto(`${server.url}/view/fixture/screens/details/`);

    await page.locator(HOME_ROW).click();
    await expect(page).toHaveURL(new RegExp("fixture/screens/home/$"));
    await expect(page.locator("body")).toHaveAttribute(
      "data-mokly-color-scheme",
      "light",
    );
    await expect(page.getByLabel("Viewport", { exact: true })).toHaveValue(
      "both",
    );
    await expectFrameSource(
      page.locator('[data-workspace-frame="mobile"]'),
      /home\/index\.mobile\.html/,
    );
    await expectShownStatus(page, "Unmodified", false);

    await page.goBack();
    await expect(page).toHaveURL(new RegExp("fixture/screens/details/$"));
    await expectShownStatus(page, "Unmodified", false);

    await page.locator('[data-filter="changed"]').click();
    await expect(page.locator(HOME_ROW)).toBeVisible();
    await page.locator(HOME_ROW).click();

    await expect(page).toHaveURL(new RegExp("fixture/screens/home/$"));
    await expect(page.locator("body")).toHaveAttribute(
      "data-mokly-color-scheme",
      "dark",
    );
    await expect(page.getByLabel("Viewport", { exact: true })).toHaveValue(
      "mobile",
    );
    await expectFrameSource(
      page.locator('[data-workspace-frame="mobile"]'),
      /home\/index\.mobile\.dark\.html/,
    );
    await expect(page.locator(SCHEME_DOT)).toBeHidden();
    await expect(page.locator(VIEWPORT_DOT)).toBeVisible();
    await expectShownStatus(page, "Changed", true);

    await page.goBack();
    await expect(page).toHaveURL(new RegExp("fixture/screens/details/$"));
    await expectShownStatus(page, "Unmodified", false);

    await page.goForward();
    await expect(page).toHaveURL(new RegExp("fixture/screens/home/$"));
    await page.reload();
    await expect(page.locator("body")).toHaveAttribute(
      "data-mokly-color-scheme",
      "light",
    );
    await expect(page.getByLabel("Viewport", { exact: true })).toHaveValue(
      "both",
    );
    await expect(page.locator(SCHEME_DOT)).toBeVisible();
    await expectShownStatus(page, "Unmodified", false);
  } finally {
    await fixture.close();
  }
});
