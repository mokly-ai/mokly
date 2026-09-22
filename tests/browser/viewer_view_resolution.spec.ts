import { expect, test, type Page } from "@playwright/test";

import type { CatalogueReadModel } from "@mokly/viewer";

import { followupFixture } from "./viewer_followup_fixture.js";

import type {} from "./viewer_harness.js";

const comparisonUrl = `__mokly/diffs/__generations/${"c".repeat(64)}/review.json`;
let fixture: Awaited<ReturnType<typeof followupFixture>>;

test.beforeAll(async () => {
  fixture = await followupFixture();
});
test.afterAll(async () => fixture?.close());

function readyCatalogue(): CatalogueReadModel {
  const source = structuredClone(fixture.catalogue);
  const changes = {
    status: "ready" as const,
    kind: "unmodified" as const,
    included: false,
  };
  return {
    ...source,
    changesStatus: "ready",
    comparisonUrl,
    collections: source.collections.map((entry) => ({ ...entry, changes })),
    screens: source.screens.map((entry) => ({ ...entry, changes })),
    pages: source.pages.map((entry) => ({ ...entry, changes })),
    useCases: source.useCases.map((entry) => ({ ...entry, changes })),
    components: source.components.map((entry) => ({ ...entry, changes })),
  };
}

async function openViewer(
  page: Page,
  id: string,
  catalogue: CatalogueReadModel,
  defaultSelection: Record<string, unknown>,
) {
  await page.goto(fixture.host.url);
  await page.waitForFunction(() => Boolean(window.viewerHarness));
  const source = JSON.stringify(catalogue);
  await page.evaluate(
    ({ defaultSelection, id, source }) =>
      window.viewerHarness.start(id, {
        source: JSON.parse(source) as CatalogueReadModel,
        defaultSelection,
      }),
    { defaultSelection, id, source },
  );
}

test("Viewer resolves a light fallback before status, marks and eligibility", async ({
  page,
}) => {
  const catalogue = readyCatalogue();
  const screen = catalogue.screens.find(({ id }) => id === "home");
  if (!screen) throw new Error("Missing Viewer screen fixture");
  screen.changes = { status: "ready", kind: "changed", included: true };
  screen.colorSchemes = ["light"];
  screen.views = screen.views
    .filter(({ colorScheme }) => colorScheme === "light")
    .map((view) => ({
      ...view,
      comparison: {
        status: "ready" as const,
        kind:
          view.viewport === "mobile"
            ? ("unmodified" as const)
            : ("changed" as const),
        eligible: view.viewport !== "mobile",
      },
    }));

  await openViewer(page, "mixed", catalogue, {
    screenId: screen.id,
    viewport: "mobile",
    colorScheme: "dark",
  });

  const root = page.locator("#mixed");
  await expect(root.locator("[data-workspace-status]")).toHaveText(
    "Unmodified",
  );
  await expect(root.locator(".mbk-diff-toolbar")).toBeHidden();
  await expect(root.locator('[data-view-changed="scheme"]')).toBeHidden();
  await expect(root.locator('[data-view-changed="viewport"]')).toBeVisible();
  await expect(
    root.getByRole("button", { name: "Dark mode", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(root.locator('[data-workspace-frame="mobile"]')).toHaveAttribute(
    "src",
    /screens\/home\.mobile\.html$/,
  );
});

test("Viewer keeps an unknown saved variant comparison ineligible", async ({
  page,
}) => {
  const catalogue = readyCatalogue();
  const component = catalogue.components.find(({ id }) => id === "pane");
  if (!component) throw new Error("Missing Viewer component fixture");
  component.changes = { status: "ready", kind: "changed", included: true };
  const variant = component.variants.find(({ id }) => id === "default");
  if (!variant) throw new Error("Missing Viewer saved variant fixture");
  variant.comparison = { status: "unavailable" };
  variant.views = variant.views.map((view) => ({
    ...view,
    comparison: { status: "unavailable" as const },
  }));

  await openViewer(page, "unknown", catalogue, {
    screenId: component.id,
    variantId: variant.id,
    viewport: "desktop",
  });

  const root = page.locator("#unknown");
  await expect(root.locator("[data-workspace-status]")).toHaveText("Changed");
  await expect(root.locator(".mbk-diff-toolbar")).toBeHidden();
});
