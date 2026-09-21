import { expect, test, type Page } from "@playwright/test";

import type { ScreenViewChanges } from "../../packages/viewer/dist/shell/metadata.js";
import { secondVariantDarkOnlyResult } from "../helpers/changed_view_fixture.js";
import { controlsEntrySource } from "../helpers/component_controls_fixture.js";
import { startEvidenceFixture } from "../helpers/evidence_fixture.js";

import { expectFrameSource } from "./workspace_actions.js";

const HOME = "screens/home.html";
const HOME_ROW = `a[data-nav-row][data-route="${HOME}"]`;
const SCHEME_DOT = '[data-view-changed="scheme"]';
const VIEWPORT_DOT = '[data-view-changed="viewport"]';

/** Only Home's dark renders differ; every light view stays unchanged. */
function darkOnlyViews(): readonly ScreenViewChanges[] {
  return [
    {
      route: HOME,
      views: [
        { viewport: "mobile", colorScheme: "light", state: "unchanged" },
        { viewport: "mobile", colorScheme: "dark", state: "changed" },
        { viewport: "desktop", colorScheme: "light", state: "unchanged" },
        { viewport: "desktop", colorScheme: "dark", state: "changed" },
      ],
    },
    {
      route: "screens/details.html",
      views: [
        { viewport: "mobile", colorScheme: "light", state: "unchanged" },
        { viewport: "mobile", colorScheme: "dark", state: "unchanged" },
        { viewport: "desktop", colorScheme: "light", state: "unchanged" },
        { viewport: "desktop", colorScheme: "dark", state: "unchanged" },
      ],
    },
  ];
}

/** The mark's painted geometry, so a hidden dot cannot pass as a drawn one. */
async function dotStyle(page: Page, selector: string) {
  return page.locator(selector).evaluate((mark) => {
    const style = getComputedStyle(mark);
    return {
      display: style.display,
      radius: style.borderTopLeftRadius,
      shadow: style.boxShadow,
      width: style.width,
    };
  });
}

test("a dark-only change marks the views it hides and opens on one", async ({
  page,
}) => {
  const fixture = await startEvidenceFixture();
  const { compilation, server } = fixture;
  try {
    server.publishUpdate({
      kind: "evidence",
      changedRoutes: [HOME],
      changesStatus: "ready",
      componentChanges: {
        baseline: compilation.manifest,
        screenViews: darkOnlyViews(),
      },
    });
    await page.goto(`${server.url}/view/${HOME}`);

    const scheme = page.getByRole("button", { name: "Dark mode", exact: true });
    await expect(scheme).toHaveAttribute("aria-pressed", "false");
    await expect(page.locator(SCHEME_DOT)).toBeVisible();
    await expect(scheme).toHaveAttribute(
      "aria-describedby",
      "mb-view-changed-scheme",
    );
    await expect(page.locator('[data-view-changed-text="scheme"]')).toHaveText(
      "Other theme changed",
    );
    await expect(page.locator(VIEWPORT_DOT)).toBeHidden();
    await expect(page.locator("[data-workspace-status]")).toHaveText("Changed");

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

    await scheme.click();
    await expect(scheme).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator(SCHEME_DOT)).toBeHidden();
    await expect(scheme).not.toHaveAttribute("aria-describedby", /.*/);
    await expect(page.locator(VIEWPORT_DOT)).toBeVisible();
    await expect(row).toBeVisible();
  } finally {
    await fixture.close();
  }
});

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
      changedRoutes: [HOME],
      changesStatus: "ready",
      componentChanges: {
        baseline: compilation.manifest,
        screenViews: darkOnlyViews(),
      },
    });

    await expect(page.locator(SCHEME_DOT)).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Dark mode", exact: true }),
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
      changedRoutes: [],
      changesStatus: "ready",
      componentChanges: {
        baseline: compilation.manifest,
        result: secondVariantDarkOnlyResult(),
      },
    });
    await page.goto(`${server.url}/view/components/action.html`);

    const row = page.locator("[data-workspace-changed-views]");
    await expect(page.locator(SCHEME_DOT)).toBeHidden();
    await expect(row).toBeHidden();

    await page
      .getByLabel("Saved variant", { exact: true })
      .selectOption("disabled");

    await expect(page.locator(SCHEME_DOT)).toBeVisible();
    await expect(row).toBeVisible();
    await expect(row).toHaveText("Changed viewsMobile · Dark, Desktop · Dark");
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
      changedRoutes: [HOME],
      changesStatus: "ready",
      componentChanges: {
        baseline: compilation.manifest,
        screenViews: darkOnlyViews(),
      },
    });
    await page.goto(`${server.url}/view/screens/details.html`);

    await page.locator(HOME_ROW).click();
    await expect(page).toHaveURL(new RegExp("screens/home\\.html$"));
    await expect(
      page.getByRole("button", { name: "Dark mode", exact: true }),
    ).toHaveAttribute("aria-pressed", "false");
    await expect(page.getByLabel("Viewport", { exact: true })).toHaveValue(
      "both",
    );
    await expectFrameSource(
      page.locator('[data-workspace-frame="mobile"]'),
      /screens\/home\.mobile\.html/,
    );

    await page.goBack();
    await expect(page).toHaveURL(new RegExp("screens/details\\.html$"));
    await page.locator('[data-filter="changed"]').click();
    await expect(page.locator(HOME_ROW)).toBeVisible();
    await page.locator(HOME_ROW).click();

    await expect(page).toHaveURL(new RegExp("screens/home\\.html$"));
    await expect(
      page.getByRole("button", { name: "Dark mode", exact: true }),
    ).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByLabel("Viewport", { exact: true })).toHaveValue(
      "mobile",
    );
    await expectFrameSource(
      page.locator('[data-workspace-frame="mobile"]'),
      /screens\/home\.mobile\.dark\.html/,
    );
    await expect(page.locator(SCHEME_DOT)).toBeHidden();
    await expect(page.locator(VIEWPORT_DOT)).toBeVisible();

    await page.reload();
    await expect(
      page.getByRole("button", { name: "Dark mode", exact: true }),
    ).toHaveAttribute("aria-pressed", "false");
    await expect(page.getByLabel("Viewport", { exact: true })).toHaveValue(
      "both",
    );
    await expect(page.locator(SCHEME_DOT)).toBeVisible();
  } finally {
    await fixture.close();
  }
});
