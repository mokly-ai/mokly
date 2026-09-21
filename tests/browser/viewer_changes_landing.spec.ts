import { expect, test, type Page } from "@playwright/test";

import type {
  CatalogueNode,
  CatalogueReadModel,
  CatalogueScreen,
  ViewerSelection,
} from "@mokly/viewer";

import { followupFixture } from "./viewer_followup_fixture.js";

import type {} from "./viewer_harness.js";

const PARENT_ID = "home";
const VARIANT_ID = "home-dark-only";

let fixture: Awaited<ReturnType<typeof followupFixture>>;
test.beforeAll(async () => {
  fixture = await followupFixture();
});
test.afterAll(async () => fixture?.close());

function attachVariant(
  nodes: readonly CatalogueNode[],
): readonly CatalogueNode[] {
  return nodes.map((node) => {
    if (node.kind === "collection")
      return { ...node, children: attachVariant(node.children) };
    if (node.id !== PARENT_ID) return node;
    return {
      ...node,
      children: [...(node.children ?? []), { kind: "entry", id: VARIANT_ID }],
    };
  });
}

function changesCatalogue(): CatalogueReadModel {
  const catalogue = structuredClone(fixture.catalogue);
  for (const entry of [
    ...catalogue.collections,
    ...catalogue.screens,
    ...catalogue.pages,
    ...catalogue.useCases,
    ...catalogue.components,
  ])
    entry.changes = {
      status: "ready",
      kind: "unmodified",
      included: false,
    };
  const index = catalogue.screens.findIndex(
    (screen) => screen.id === PARENT_ID,
  );
  const parent = catalogue.screens[index]!;
  parent.changes = { status: "ready", kind: "unmodified", included: false };
  const variant: CatalogueScreen = {
    ...structuredClone(parent),
    id: VARIANT_ID,
    title: "Dark-only variant",
    route: "screens/home.variants/dark-only.html",
    variantOf: PARENT_ID,
    useCaseIds: [],
    changes: { status: "ready", kind: "changed", included: true },
    views: parent.views.map((view) => ({
      ...view,
      fragmentPath: `static/screens/home.variants/dark-only.${view.viewport}${view.colorScheme === "dark" ? ".dark" : ""}.html`,
      usage: { status: "unavailable" },
      comparison:
        view.viewport === "mobile" && view.colorScheme === "dark"
          ? { status: "ready", kind: "changed", eligible: true }
          : { status: "ready", kind: "unmodified", eligible: false },
    })),
  };
  catalogue.screens = [
    ...catalogue.screens.slice(0, index + 1),
    variant,
    ...catalogue.screens.slice(index + 1),
  ];
  catalogue.tree.pages = attachVariant(catalogue.tree.pages);
  catalogue.changesStatus = "ready";
  catalogue.revision.content += 1;
  return catalogue;
}

async function openChangesViewer(
  page: Page,
  controlled: boolean,
): Promise<void> {
  await page.goto(fixture.host.url);
  await page.waitForFunction(() => Boolean(window.viewerHarness));
  const catalogueJson = JSON.stringify(changesCatalogue());
  await page.evaluate(
    ({ catalogueJson, controlled, variantId }) => {
      window.viewerHarness.start("one", {
        controlled,
        source: JSON.parse(catalogueJson) as CatalogueReadModel,
        defaultSelection: {
          screenId: variantId,
          view: "changes",
          viewport: "desktop",
          colorScheme: "light",
        },
      });
    },
    { catalogueJson, controlled, variantId: VARIANT_ID },
  );
  await expect(
    page.getByRole("heading", { name: "Dark-only variant", exact: true }),
  ).toBeVisible();
  await expect(
    page.locator(`[data-nav-row][data-entry-id="${VARIANT_ID}"]`),
  ).toHaveCount(1);
  await page.waitForFunction(() =>
    Boolean(window.viewerHarness.get("one").ref.current),
  );
  await expect(page.locator('[data-filter="changed"]')).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await page.evaluate(() => {
    window.viewerHarness.get("one").events.length = 0;
  });
}

async function latestProposal(page: Page): Promise<ViewerSelection> {
  return page.evaluate(
    () =>
      window.viewerHarness
        .get("one")
        .events.filter((event) => event.name === "selection")
        .at(-1)!.value as ViewerSelection,
  );
}

test("Changes activation commits the variant and its first changed view", async ({
  page,
}) => {
  await openChangesViewer(page, false);

  await page.locator(`[data-nav-row][data-entry-id="${PARENT_ID}"]`).click();

  await expect(page.getByLabel("Viewport", { exact: true })).toHaveValue(
    "mobile",
  );
  await expect(
    page.getByRole("button", { name: "Dark mode", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  expect(await latestProposal(page)).toEqual({
    screenId: VARIANT_ID,
    view: "changes",
    viewport: "mobile",
    colorScheme: "dark",
    search: "",
    tags: [],
  });
});

test("a controlled Changes activation waits for the complete proposal", async ({
  page,
}) => {
  await openChangesViewer(page, true);

  await page.locator(`[data-nav-row][data-entry-id="${PARENT_ID}"]`).click();

  await expect(page.getByLabel("Viewport", { exact: true })).toHaveValue(
    "desktop",
  );
  await expect(
    page.getByRole("button", { name: "Dark mode", exact: true }),
  ).toHaveAttribute("aria-pressed", "false");
  const proposal = await latestProposal(page);
  expect(proposal).toEqual({
    screenId: VARIANT_ID,
    view: "changes",
    viewport: "mobile",
    colorScheme: "dark",
    search: "",
    tags: [],
  });

  await page.evaluate((selection) => {
    window.viewerHarness.get("one").setSelection(selection);
  }, proposal);
  await expect(
    page.getByRole("button", { name: "Dark mode", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
});

test("an imperative screen selection keeps the sticky view axes", async ({
  page,
}) => {
  await openChangesViewer(page, false);

  await page.evaluate(
    ({ parentId, variantId }) => {
      const host = window.viewerHarness.get("one");
      host.ref.current.select({ screenId: parentId });
      host.events.length = 0;
      host.ref.current.select({ screenId: variantId });
    },
    { parentId: PARENT_ID, variantId: VARIANT_ID },
  );

  expect(await latestProposal(page)).toEqual({
    screenId: VARIANT_ID,
    view: "all",
    viewport: "desktop",
    colorScheme: "light",
    search: "",
    tags: [],
  });
});
