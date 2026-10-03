import type { Page } from "@playwright/test";
import { expect } from "@playwright/test";

import type { CatalogueNode, CatalogueReadModel } from "@mokly/viewer";

import { followupFixture } from "./viewer_followup_fixture.js";

export const suiteState = {
  fixture: undefined! as Awaited<ReturnType<typeof followupFixture>>,
};

export async function openViewer(
  page: Page,
  cross: boolean,
  controlled = false,
) {
  await page.goto(suiteState.fixture.host.url);
  await page.waitForFunction(() => Boolean(window.viewerHarness));
  await page.evaluate(
    ({ cross, controlled }) =>
      window.viewerHarness.start("one", {
        cross,
        controlled,
        defaultSelection: { screenId: "pane", viewport: "desktop" },
      }),
    { cross, controlled },
  );
  await expect(
    page
      .getByRole("navigation", { name: "Saved variants" })
      .getByRole("link", { name: "Default", exact: true }),
  ).toHaveAttribute("aria-current", "page");
}

export function appendScreenVariant(
  node: CatalogueNode,
  parentId: string,
  variantId: string,
): CatalogueNode {
  if (node.kind === "entry" && node.id === parentId)
    return {
      ...node,
      children: [...(node.children ?? []), { kind: "entry", id: variantId }],
    };
  return node.children
    ? {
        ...node,
        children: node.children.map((child) =>
          appendScreenVariant(child, parentId, variantId),
        ),
      }
    : node;
}

export function screenVariantCatalogue(): CatalogueReadModel {
  const source = structuredClone(suiteState.fixture.catalogue);
  const unmodified = {
    status: "ready" as const,
    kind: "unmodified" as const,
    included: false,
  };
  const model: CatalogueReadModel = {
    ...source,
    screens: source.screens.map((entry) => ({
      ...entry,
      changes: unmodified,
    })),
    pages: source.pages.map((entry) => ({
      ...entry,
      changes: unmodified,
    })),
    useCases: source.useCases.map((entry) => ({
      ...entry,
      changes: unmodified,
    })),
    components: source.components.map((entry) => ({
      ...entry,
      changes: unmodified,
    })),
  };
  const parentIndex = model.screens.findIndex(({ id }) => id === "home");
  const parent = model.screens[parentIndex];
  if (!parent) throw new Error("Missing viewer screen fixture");
  const variant = {
    ...parent,
    id: "home-error",
    title: "Save failed",
    route: "screens/home-error.html",
    variantOf: parent.id,
    changes: {
      status: "ready" as const,
      kind: "changed" as const,
      included: true,
    },
    views: parent.views.map((view) => ({
      ...view,
      fragmentPath: `static/mokly-generated/screens/home-error.${view.viewport}${
        view.colorScheme === "dark" ? ".dark" : ""
      }.html`,
      comparison:
        view.viewport === "mobile" && view.colorScheme === "dark"
          ? {
              status: "ready" as const,
              kind: "changed" as const,
              eligible: true,
            }
          : {
              status: "ready" as const,
              kind: "unmodified" as const,
              eligible: false,
            },
    })),
  };
  return {
    ...model,
    changesStatus: "ready",
    screens: [
      ...model.screens.slice(0, parentIndex),
      { ...parent, changes: unmodified },
      variant,
      ...model.screens.slice(parentIndex + 1),
    ],
    tree: {
      ...model.tree,
      pages: model.tree.pages.map((node) =>
        appendScreenVariant(node, parent.id, variant.id),
      ),
    },
  };
}

export async function openScreenVariantViewer(page: Page, controlled: boolean) {
  const catalogue = JSON.stringify(screenVariantCatalogue());
  await page.goto(suiteState.fixture.host.url);
  await page.waitForFunction(() => Boolean(window.viewerHarness));
  await page.evaluate(
    ({ catalogue, controlled }) => {
      window.viewerHarness.start("screen-variants", {
        controlled,
        source: JSON.parse(catalogue) as CatalogueReadModel,
        defaultSelection: {
          screenId: "home",
          view: "changes",
          viewport: "both",
          colorScheme: "light",
        },
      });
    },
    { catalogue, controlled },
  );
}

export const startSuite = async () => {
  suiteState.fixture = await followupFixture();
};

export const stopSuite = async () => suiteState.fixture?.close();
