import { expect, test, type Page } from "@playwright/test";

import {
  darkOnlyScreenViews,
  secondVariantDarkOnlyResult,
} from "../helpers/changed_view_fixture.js";
import { controlsEntrySource } from "../helpers/component_controls_fixture.js";
import { startEvidenceFixture } from "../helpers/evidence_fixture.js";
import { reparentedEntrySource } from "../helpers/fixture.js";

import { expectFrameSource } from "./workspace_actions.js";

const HOME = "screens/home.html";
const HOME_ROW = `a[data-nav-row][data-route="${HOME}"]`;
const SCHEME_DOT = '[data-view-changed="scheme"]';
const VIEWPORT_DOT = '[data-view-changed="viewport"]';
const TOOLBAR = ".mbk-diff-toolbar";

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

async function expectShownStatus(
  page: Page,
  status: "Changed" | "Unmodified",
  comparison: boolean,
): Promise<void> {
  await expect(page.locator("[data-workspace-status]")).toHaveText(status);
  if (comparison) await expect(page.locator(TOOLBAR)).toBeVisible();
  else await expect(page.locator(TOOLBAR)).toBeHidden();
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
      changedRoutes: [HOME],
      changesStatus: "ready",
      componentChanges: {
        baseline: compilation.manifest,
        screenViews: [
          {
            route: HOME,
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
      /screens\/home\.mobile\.html$/,
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
      changedRoutes: [],
      changesStatus: "ready",
      componentChanges: {
        baseline: compilation.manifest,
        result: secondVariantDarkOnlyResult(),
      },
    });
    await page.goto(`${server.url}/view/components/action.html`);

    const row = page.locator("[data-workspace-changed-views]");
    const scheme = page.getByLabel("Appearance", { exact: true });
    await expect(page.locator(SCHEME_DOT)).toBeHidden();
    await expect(row).toBeHidden();
    await expectShownStatus(page, "Unmodified", false);

    await page
      .getByLabel("Saved variant", { exact: true })
      .selectOption("disabled");

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
      changedRoutes: [HOME],
      changesStatus: "ready",
      componentChanges: {
        baseline: compilation.manifest,
        screenViews: darkOnlyScreenViews(),
      },
    });
    await page.goto(`${server.url}/view/screens/details.html`);

    await page.locator(HOME_ROW).click();
    await expect(page).toHaveURL(new RegExp("screens/home\\.html$"));
    await expect(page.locator("body")).toHaveAttribute(
      "data-mokly-color-scheme",
      "light",
    );
    await expect(page.getByLabel("Viewport", { exact: true })).toHaveValue(
      "both",
    );
    await expectFrameSource(
      page.locator('[data-workspace-frame="mobile"]'),
      /screens\/home\.mobile\.html/,
    );
    await expectShownStatus(page, "Unmodified", false);

    await page.goBack();
    await expect(page).toHaveURL(new RegExp("screens/details\\.html$"));
    await expectShownStatus(page, "Unmodified", false);

    await page.locator('[data-filter="changed"]').click();
    await expect(page.locator(HOME_ROW)).toBeVisible();
    await page.locator(HOME_ROW).click();

    await expect(page).toHaveURL(new RegExp("screens/home\\.html$"));
    await expect(page.locator("body")).toHaveAttribute(
      "data-mokly-color-scheme",
      "dark",
    );
    await expect(page.getByLabel("Viewport", { exact: true })).toHaveValue(
      "mobile",
    );
    await expectFrameSource(
      page.locator('[data-workspace-frame="mobile"]'),
      /screens\/home\.mobile\.dark\.html/,
    );
    await expect(page.locator(SCHEME_DOT)).toBeHidden();
    await expect(page.locator(VIEWPORT_DOT)).toBeVisible();
    await expectShownStatus(page, "Changed", true);

    await page.goBack();
    await expect(page).toHaveURL(new RegExp("screens/details\\.html$"));
    await expectShownStatus(page, "Unmodified", false);

    await page.goForward();
    await expect(page).toHaveURL(new RegExp("screens/home\\.html$"));
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
