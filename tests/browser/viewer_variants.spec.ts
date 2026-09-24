import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

import type {
  CatalogueNode,
  CatalogueReadModel,
  InstanceRef,
  ViewerSelection,
} from "@mokly/viewer";
import { currentDocumentPath } from "@mokly/viewer/data";

import { followupFixture } from "./viewer_followup_fixture.js";

import type {} from "./viewer_harness.js";

let fixture: Awaited<ReturnType<typeof followupFixture>>;
test.beforeAll(async () => {
  fixture = await followupFixture();
});
test.afterAll(async () => fixture?.close());

async function openViewer(page: Page, cross: boolean, controlled = false) {
  await page.goto(fixture.host.url);
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
    page.getByRole("combobox", { name: "Saved variant" }),
  ).toHaveValue("default");
}

function appendScreenVariant(
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

function screenVariantCatalogue(): CatalogueReadModel {
  const source = structuredClone(fixture.catalogue);
  const unmodified = {
    status: "ready" as const,
    kind: "unmodified" as const,
    included: false,
  };
  const model: CatalogueReadModel = {
    ...source,
    collections: source.collections.map((entry) => ({
      ...entry,
      changes: unmodified,
    })),
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
    route: "screens/home.variants/error.html",
    variantOf: parent.id,
    changes: {
      status: "ready" as const,
      kind: "changed" as const,
      included: true,
    },
    views: parent.views.map((view) => ({
      ...view,
      fragmentPath: currentDocumentPath(
        `screens/home.variants/error.${view.viewport}${view.colorScheme === "dark" ? ".dark" : ""}.html`,
        model.generatedPathPrefix,
      ),
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

async function openScreenVariantViewer(page: Page, controlled: boolean) {
  const catalogue = JSON.stringify(screenVariantCatalogue());
  await page.goto(fixture.host.url);
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

test("Changes proposes a variant screen and its first changed view atomically", async ({
  page,
}) => {
  const parent = 'a[data-nav-row][data-route="screens/home.html"]';

  await openScreenVariantViewer(page, false);
  expect(
    await page.evaluate(() =>
      window.viewerHarness
        .get("screen-variants")
        .events.filter((event) => event.name === "error"),
    ),
  ).toEqual([]);
  await page.locator(parent).click();
  await expect(page.locator("#screen-variants h2")).toHaveText("Save failed");
  const committed = await page.evaluate(() =>
    window.viewerHarness
      .get("screen-variants")
      .events.find((event) => event.name === "selection"),
  );
  expect(committed?.value).toEqual(
    expect.objectContaining({
      screenId: "home-error",
      viewport: "mobile",
      colorScheme: "dark",
    }),
  );

  await page.reload();
  await page.waitForFunction(() => Boolean(window.viewerHarness));
  await openScreenVariantViewer(page, true);
  await page.locator(parent).click();
  await expect(page.locator("#screen-variants h2")).toHaveText("Home");
  const proposal = await page.evaluate(
    () =>
      window.viewerHarness
        .get("screen-variants")
        .events.find((event) => event.name === "selection")?.value,
  );
  expect(proposal).toEqual(
    expect.objectContaining({
      screenId: "home-error",
      viewport: "mobile",
      colorScheme: "dark",
    }),
  );
  await page.evaluate((selection) => {
    window.viewerHarness
      .get("screen-variants")
      .setSelection(selection as ViewerSelection);
  }, proposal);
  await expect(page.locator("#screen-variants h2")).toHaveText("Save failed");
});

for (const cross of [false, true]) {
  const adapter = cross ? "postMessage" : "same-origin";

  test(`${adapter} commits variants from the workspace and public handle`, async ({
    page,
  }) => {
    await openViewer(page, cross);
    const selector = page.getByRole("combobox", { name: "Saved variant" });
    await selector.selectOption("second");
    await expect(selector).toHaveValue("second");
    await expect(
      page
        .frameLocator('iframe[data-workspace-frame="desktop"]')
        .getByText("Second content"),
    ).toBeVisible();
    await page.evaluate(() =>
      window.viewerHarness
        .get("one")
        .ref.current.select({ variantId: "default" }),
    );
    await expect(selector).toHaveValue("default");
    await expect(
      page
        .frameLocator('iframe[data-workspace-frame="desktop"]')
        .getByText("First content"),
    ).toBeVisible();
    const events = await page.evaluate(() =>
      window.viewerHarness
        .get("one")
        .events.filter((event) =>
          ["selection", "navigate"].includes(event.name),
        ),
    );
    expect(events).toEqual([
      {
        name: "navigate",
        value: expect.objectContaining({
          screenId: "pane",
          variantId: "second",
        }),
      },
      {
        name: "selection",
        value: expect.objectContaining({
          screenId: "pane",
          variantId: "second",
        }),
      },
      {
        name: "navigate",
        value: expect.objectContaining({
          screenId: "pane",
          variantId: "default",
        }),
      },
      {
        name: "selection",
        value: expect.objectContaining({
          screenId: "pane",
          variantId: "default",
        }),
      },
    ]);
  });

  test(`${adapter} keeps a controlled variant proposal inert until committed`, async ({
    page,
  }) => {
    await openViewer(page, cross, true);
    const selector = page.getByRole("combobox", { name: "Saved variant" });
    await selector.selectOption("second");
    await expect(selector).toHaveValue("default");
    await expect(
      page
        .frameLocator('iframe[data-workspace-frame="desktop"]')
        .getByText("First content"),
    ).toBeVisible();
    const proposal = await page.evaluate(
      () =>
        window.viewerHarness
          .get("one")
          .events.find((event) => event.name === "selection")!.value,
    );
    expect(proposal).toEqual(
      expect.objectContaining({ screenId: "pane", variantId: "second" }),
    );
    await page.evaluate((selection) => {
      window.viewerHarness
        .get("one")
        .setSelection(selection as ViewerSelection);
    }, proposal);
    await expect(selector).toHaveValue("second");
    await expect(
      page
        .frameLocator('iframe[data-workspace-frame="desktop"]')
        .getByText("Second content"),
    ).toBeVisible();
    expect(
      await page.evaluate(() =>
        window.viewerHarness
          .get("one")
          .events.filter((event) => event.name === "selection"),
      ),
    ).toHaveLength(1);
    expect(
      await page.evaluate(
        () =>
          window.viewerHarness
            .get("one")
            .events.find((event) => event.name === "navigate")?.value,
      ),
    ).toEqual(
      expect.objectContaining({ screenId: "pane", variantId: "second" }),
    );
  });

  test(`${adapter} rejects an invalid imperative variant once`, async ({
    page,
  }) => {
    await openViewer(page, cross);
    const message = await page.evaluate(() => {
      try {
        window.viewerHarness
          .get("one")
          .ref.current.select({ variantId: "missing" });
        return "resolved";
      } catch (error) {
        return error instanceof Error ? error.message : "rejected";
      }
    });
    expect(message).toBe("The requested catalogue selection is unavailable.");
    await expect(
      page.getByRole("combobox", { name: "Saved variant" }),
    ).toHaveValue("default");
    expect(
      await page.evaluate(() =>
        window.viewerHarness
          .get("one")
          .events.filter((event) => event.name === "error"),
      ),
    ).toEqual([
      {
        name: "error",
        value: {
          code: "selection",
          message: "The requested catalogue selection is unavailable.",
        },
      },
    ]);
  });

  test(`${adapter} inspects only the selected non-default variant`, async ({
    page,
  }) => {
    await openViewer(page, cross);
    const variant = fixture.catalogue.components
      .find((entry) => entry.id === "pane")!
      .variants.find((entry) => entry.id === "second")!;
    const view = variant.views.find(
      (entry) => entry.viewport === "desktop" && entry.colorScheme === "light",
    )!;
    if (view.usage.status !== "ready") throw new Error("Expected ready usage");
    const instance: InstanceRef = {
      screenId: "pane",
      variantId: "second",
      viewport: "desktop",
      colorScheme: "light",
      key: view.usage.instances[0]!.key,
    };
    await page.evaluate(
      async ({ instance }) => {
        const viewer = window.viewerHarness.get("one").ref.current;
        viewer.select({ variantId: "second" });
        await viewer.scrollToInstance(instance);
        await viewer.highlightInstance(instance);
      },
      { instance },
    );
    await expect(page.locator("[data-mokly-label-layer] button")).toHaveCount(
      1,
    );
    const outcomes = await page.evaluate(async (instance) => {
      const viewer = window.viewerHarness.get("one").ref.current;
      const mismatched = { ...instance, variantId: "default" };
      return Promise.all([
        viewer.highlightInstance(mismatched).then(
          () => "resolved",
          () => "rejected",
        ),
        viewer.scrollToInstance(mismatched).then(
          () => "resolved",
          () => "rejected",
        ),
      ]);
    }, instance);
    expect(outcomes).toEqual(["rejected", "rejected"]);
  });
}
