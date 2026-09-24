import { expect, test } from "@playwright/test";

import type {
  CatalogueReadModel,
  MoklyViewerProps,
  ViewerSelection,
} from "@mokly/viewer";

import { viewerFixture } from "../../packages/viewer/tests/browser_fixture.js";

import type {} from "./viewer_harness.js";

let fixture: Awaited<ReturnType<typeof viewerFixture>>;
test.beforeAll(async () => {
  fixture = await viewerFixture();
});
test.afterAll(async () => {
  await fixture.close();
});
test.beforeEach(async ({ page }) => {
  await page.goto(fixture.host.url);
  await page.waitForFunction(() => Boolean(window.viewerHarness));
});

test("frame links and saved variants emit only committed navigation", async ({
  page,
}) => {
  await page.evaluate(() => window.viewerHarness.start("one", { cross: true }));
  const frame = page.frameLocator('#one iframe[data-workspace-frame="mobile"]');
  await frame.getByRole("link", { name: "Open Action" }).click();
  await expect(
    page.locator("#one").getByRole("heading", { name: "Action", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("combobox", { name: "Saved variant" })
    .selectOption("disabled");
  const events = await page.evaluate(() =>
    window.viewerHarness
      .get("one")
      .events.filter((event) => event.name === "navigate")
      .map((event) => event.value),
  );
  expect(events).toEqual([
    expect.objectContaining({
      screenId: "action",
      route: "components/action.html",
      navigation: {
        id: "action",
        target: { kind: "self" },
        activation: "primary",
      },
    }),
    expect.objectContaining({ screenId: "action", variantId: "disabled" }),
  ]);
});

test("Escape and navigation end active picks exactly once", async ({
  page,
}) => {
  await page.evaluate(() => window.viewerHarness.start("one", { cross: true }));
  await page.waitForFunction(() =>
    Boolean(window.viewerHarness.get("one").ref.current),
  );
  await page.evaluate(async () => {
    await window.viewerHarness.get("one").ref.current.startPick();
  });
  await page.keyboard.press("Escape");
  await page.evaluate(async () => {
    const host = window.viewerHarness.get("one");
    await host.ref.current.startPick();
    host.ref.current.select({ screenId: "action" });
    host.ref.current.cancelPick();
  });
  expect(
    await page.evaluate(() =>
      window.viewerHarness
        .get("one")
        .events.filter((event) => event.name === "pick-end")
        .map((event) => event.value),
    ),
  ).toEqual([{ reason: "escape" }, { reason: "navigation" }]);
});

test("flow events preserve the screen key and identify the owning step", async ({
  page,
}) => {
  await page.evaluate(() => {
    const host = window.viewerHarness.start("one", { cross: true });
    const catalogue = structuredClone(
      host.props.catalogue,
    ) as CatalogueReadModel;
    catalogue.screens[0]!.useCaseIds = ["tour"];
    catalogue.useCases = [
      {
        kind: "use-case",
        id: "tour",
        navPath: [],
        title: "Tour",
        route: "flows/tour.html",
        tags: [],
        details: catalogue.screens[0]!.details,
        changes: { status: "disabled" },
        steps: [{ screenId: "home" }, { screenId: "home" }],
      },
    ];
    catalogue.tree.pages = [
      ...catalogue.tree.pages,
      { kind: "entry", id: "tour" },
    ];
    host.props = {
      ...host.props,
      catalogue,
      defaultSelection: { screenId: "tour", viewport: "desktop" },
    } as MoklyViewerProps;
    host.render();
  });
  await page.waitForFunction(() =>
    Boolean(window.viewerHarness.get("one").ref.current),
  );
  await page.evaluate(async () => {
    await window.viewerHarness.get("one").ref.current.startPick();
  });
  await page
    .frameLocator(".flow-step:nth-child(2) iframe")
    .getByText("Visible", { exact: true })
    .click();
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          window.viewerHarness
            .get("one")
            .events.find((event) => event.name === "click")?.value,
      ),
    )
    .toEqual(
      expect.objectContaining({
        instance: expect.objectContaining({
          screenId: "home",
          viewport: "desktop",
          stepIndex: 1,
        }),
        frame: { entryId: "tour", stepIndex: 1 },
      }),
    );
});

test("comparison is lazy, confined, and reports safe failures", async ({
  page,
}) => {
  const comparisons: string[] = [];
  await page.route("**/__mokly/diffs/**", async (route) => {
    comparisons.push(route.request().url());
    await route.fulfill({
      status: 503,
      json: { details: "/private/user/secret.ts" },
    });
  });
  await page.evaluate(() => {
    const host = window.viewerHarness.start("one");
    const catalogue = structuredClone(
      host.props.catalogue,
    ) as CatalogueReadModel;
    catalogue.changesStatus = "ready";
    catalogue.comparisonUrl = `__mokly/diffs/__generations/${"a".repeat(64)}/review.json`;
    for (const entry of [...catalogue.screens, ...catalogue.components])
      entry.changes = { status: "ready", kind: "changed", included: true };
    for (const view of catalogue.screens[0]!.views)
      view.comparison = { status: "ready", kind: "changed", eligible: true };
    host.props = { ...host.props, catalogue } as MoklyViewerProps;
    host.render();
  });
  await expect(
    page.getByRole("heading", { name: "Home", exact: true }),
  ).toBeVisible();
  expect(comparisons).toHaveLength(0);
  await page.locator('[data-diff-mode="side"]').click();
  await expect(
    page.getByText("The comparison could not be loaded.", { exact: false }),
  ).toBeVisible();
  expect(comparisons).toHaveLength(1);
  expect(
    await page.evaluate(() =>
      window.viewerHarness
        .get("one")
        .events.filter((event) => event.name === "error")
        .map((event) => event.value),
    ),
  ).toEqual([
    {
      code: "comparison",
      message: "The comparison could not be loaded. Try again.",
    },
  ]);
  await expect(page.getByText("/private/user/secret.ts")).toHaveCount(0);
  const rejected = await page.evaluate(async () => {
    try {
      await window.viewerHarness.get("one").ref.current.startPick();
      return false;
    } catch {
      return true;
    }
  });
  expect(rejected).toBe(true);
});

test("accepted controlled state and host Back/Forward do not echo proposals", async ({
  page,
}) => {
  await page.evaluate(() =>
    window.viewerHarness.start("one", { controlled: true, accept: true }),
  );
  await page.getByRole("link", { name: "Action", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Action", exact: true }),
  ).toBeVisible();
  await page.evaluate(() => {
    const host = window.viewerHarness.get("one");
    host.setSelection({
      ...host.props.selection!,
      screenId: "home",
    } as ViewerSelection);
  });
  await expect(
    page.getByRole("heading", { name: "Home", exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(() =>
      window.viewerHarness
        .get("one")
        .events.filter((event) => event.name === "selection"),
    ),
  ).toHaveLength(1);
  expect(
    await page.evaluate(() =>
      window.viewerHarness
        .get("one")
        .events.filter((event) => event.name === "navigate"),
    ),
  ).toHaveLength(2);
});
