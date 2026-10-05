import { expect, test, type Page } from "@playwright/test";

import type {
  CatalogueReadModel,
  MoklyViewerProps,
  ViewerSelection,
} from "@mokly/viewer";

import { readCurrentPath } from "../../packages/viewer/src/catalogue/path_values.js";
import { viewerFixture } from "../../packages/viewer/tests/browser_fixture.js";

import type {} from "./viewer_harness.js";
import { chooseVariant } from "./workspace_actions.js";

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
  await chooseVariant(page, "Disabled");
  const events = await page.evaluate(() =>
    window.viewerHarness
      .get("one")
      .events.filter((event) => event.name === "navigate")
      .map((event) => event.value),
  );
  expect(events).toEqual([
    expect.objectContaining({
      screenPath: "action",
      navigation: {
        screenPath: "action",
        target: { kind: "self" },
        activation: "primary",
      },
    }),
    { screenPath: "action/disabled" },
  ]);
});

async function activateUnknownFrameLink(page: Page) {
  const link = page
    .frameLocator('iframe[data-workspace-frame="mobile"]')
    .getByRole("link", { name: "Open Action" });
  await link.evaluate((element) =>
    element.setAttribute("data-mokly-link", "missing-entry"),
  );
  await link.click();
}

test("an uncontrolled frame miss can be replaced by its committed selection", async ({
  page,
}) => {
  await page.evaluate(() => window.viewerHarness.start("one"));
  await activateUnknownFrameLink(page);
  await expect(
    page.getByRole("heading", { name: "Item not found", exact: true }),
  ).toBeVisible();

  await page.evaluate(() =>
    window.viewerHarness.get("one").ref.current.select({ screenPath: "home" }),
  );
  await expect(
    page.getByRole("heading", { name: "Home", exact: true }),
  ).toBeVisible();
});

test("a controlled frame miss reports only an error and keeps its display", async ({
  page,
}) => {
  await page.evaluate(() =>
    window.viewerHarness.start("one", { controlled: true }),
  );
  await activateUnknownFrameLink(page);

  await expect(
    page.getByRole("heading", { name: "Home", exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(() =>
      window.viewerHarness
        .get("one")
        .events.filter((event) =>
          ["error", "selection", "navigate"].includes(event.name),
        ),
    ),
  ).toEqual([
    {
      name: "error",
      value: {
        code: "frame",
        message: "The requested catalogue selection is unavailable.",
      },
    },
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
    host.ref.current.select({ screenPath: "action" });
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
    catalogue.screens[0]!.useCasePaths = ["tour"].map(readCurrentPath);
    catalogue.useCases = [
      {
        kind: "use-case",
        path: readCurrentPath("tour"),

        title: "Tour",
        tags: [],
        details: catalogue.screens[0]!.details,
        changes: { status: "disabled" },
        steps: [
          { screenPath: readCurrentPath("home") },
          { screenPath: readCurrentPath("home") },
        ],
      },
    ];
    catalogue.tree = [
      ...catalogue.tree,
      { kind: "entry", path: readCurrentPath("tour") },
    ];
    host.props = {
      ...host.props,
      catalogue,
      defaultSelection: { screenPath: "tour", viewport: "desktop" },
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
          screenPath: "home",
          viewport: "desktop",
          stepIndex: 1,
        }),
        frame: { entryPath: "tour", stepIndex: 1 },
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
      screenPath: "home",
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
