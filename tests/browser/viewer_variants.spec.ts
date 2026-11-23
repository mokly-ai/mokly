import type { Page } from "@playwright/test";
import { expect } from "@playwright/test";

import type { InstanceRef, ViewerSelection } from "@mokly/viewer";

import { test } from "./browser_test.js";
import { followupFixture } from "./viewer_followup_fixture.js";
import type {} from "./viewer_harness.js";
import { NARROW_WINDOW } from "./workspace_actions.js";

let fixture: Awaited<ReturnType<typeof followupFixture>>;

/**
 * The frame that holds the selection: on the canvas, the selected saved
 * variant's Light frame in its component's variant set.
 */
const SELECTED = ".mbk-canvas-frame[data-selected] iframe";

/** Expect the selection on the Light frame of the variant `path`. */
async function expectSelectedVariant(page: Page, path: string) {
  await expect(page.locator(SELECTED)).toHaveAttribute(
    "data-workspace-variant",
    path,
  );
}

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
        defaultSelection: { screenPath: "pane/default", viewport: "desktop" },
      }),
    { cross, controlled },
  );
  // The variant bar stands in the right panel, which the compact layout
  // keeps in its closed sheet.
  await expect(
    page
      .getByRole("navigation", { name: "Saved variants", includeHidden: true })
      .getByRole("link", { name: "Default", exact: true, includeHidden: true }),
  ).toHaveAttribute("aria-current", "page");
}

for (const cross of [false, true]) {
  const adapter = cross ? "postMessage" : "same-origin";

  test(`${adapter} commits variants from the workspace and public handle`, async ({
    page,
  }) => {
    await openViewer(page, cross);
    const variants = page.getByRole("navigation", { name: "Saved variants" });
    const first = variants.getByRole("link", { name: "Default", exact: true });
    const second = variants.getByRole("link", { name: "Second", exact: true });
    await second.click();
    await expect(second).toHaveAttribute("aria-current", "page");
    await expectSelectedVariant(page, "pane/second");
    await expect(
      page.frameLocator(SELECTED).getByText("Second content"),
    ).toBeVisible();
    await page.evaluate(() =>
      window.viewerHarness
        .get("one")
        .ref.current.select({ screenPath: "pane/default" }),
    );
    await expect(first).toHaveAttribute("aria-current", "page");
    await expectSelectedVariant(page, "pane/default");
    await expect(
      page.frameLocator(SELECTED).getByText("First content"),
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
        value: { screenPath: "pane/second" },
      },
      {
        name: "selection",
        value: expect.objectContaining({
          screenPath: "pane/second",
        }),
      },
      {
        name: "navigate",
        value: { screenPath: "pane/default" },
      },
      {
        name: "selection",
        value: expect.objectContaining({
          screenPath: "pane/default",
        }),
      },
    ]);
  });

  test(`${adapter} keeps a controlled variant proposal inert until committed`, async ({
    page,
  }) => {
    await openViewer(page, cross, true);
    const variants = page.getByRole("navigation", { name: "Saved variants" });
    const first = variants.getByRole("link", { name: "Default", exact: true });
    const second = variants.getByRole("link", { name: "Second", exact: true });
    await second.click();
    await expect(first).toHaveAttribute("aria-current", "page");
    await expectSelectedVariant(page, "pane/default");
    await expect(
      page.frameLocator(SELECTED).getByText("First content"),
    ).toBeVisible();
    const proposal = await page.evaluate(
      () =>
        window.viewerHarness
          .get("one")
          .events.find((event) => event.name === "selection")!.value,
    );
    expect(proposal).toEqual(
      expect.objectContaining({ screenPath: "pane/second" }),
    );
    await page.evaluate((selection) => {
      window.viewerHarness
        .get("one")
        .setSelection(selection as ViewerSelection);
    }, proposal);
    await expect(second).toHaveAttribute("aria-current", "page");
    await expectSelectedVariant(page, "pane/second");
    await expect(
      page.frameLocator(SELECTED).getByText("Second content"),
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
    ).toEqual({ screenPath: "pane/second" });
  });

  test(`${adapter} treats an unknown imperative entry as unavailable`, async ({
    page,
  }) => {
    await openViewer(page, cross);
    await page.evaluate(() => {
      window.viewerHarness.get("one").ref.current.select({
        screenPath: "missing",
      });
    });
    await expect(
      page.getByRole("heading", { name: "Item not found" }),
    ).toBeVisible();
    expect(
      await page.evaluate(() =>
        window.viewerHarness
          .get("one")
          .events.filter((event) => event.name === "error"),
      ),
    ).toEqual([]);
  });

  for (const canvas of [true, false])
    test(`${adapter} ${canvas ? "on the canvas, inspects the named variant's row and rejects an entry that it does not show" : "below the layout breakpoint, inspects only the selected non-default variant"}`, async ({
      page,
    }) => {
      if (!canvas) await page.setViewportSize(NARROW_WINDOW);
      await inspectsSecond(page, cross, canvas);
    });
}

/**
 * Highlight an instance of the selected saved variant `pane/second`, then a
 * reference that the stage does not show: on the canvas, whose rows each show
 * their own variant, an entry outside the set; below the layout breakpoint,
 * the sibling variant that the compact layout's one frame does not show.
 */
async function inspectsSecond(page: Page, cross: boolean, canvas: boolean) {
  await openViewer(page, cross);
  const component = fixture.index.components.find(
    (entry) => entry.path === "pane",
  )!;
  const variant = fixture.index.components
    .filter((entry) => entry.variantOf === component.path)
    .find((entry) => entry.path === "pane/second")!;
  const view = fixture.details.current[variant.path]!.views.find(
    (entry) => entry.viewport === "desktop" && entry.colorScheme === "light",
  )!;
  if (view.usage.status !== "ready") throw new Error("Expected ready usage");
  const instance: InstanceRef = {
    screenPath: "pane/second",
    viewport: "desktop",
    colorScheme: "light",
    key: view.usage.instances[0]!.key,
  };
  await page.evaluate(() =>
    window.viewerHarness
      .get("one")
      .ref.current.select({ screenPath: "pane/second" }),
  );
  const shown = canvas
    ? SELECTED
    : ".mbk-canvas-cell:not([hidden]) iframe[data-workspace-frame]";
  await expect(page.locator(shown)).toHaveAttribute(
    "data-mokly-frame-state",
    "ready",
  );
  await expect(
    page.frameLocator(shown).getByText("Second content"),
  ).toBeVisible();
  await page.evaluate(
    async ({ instance }) => {
      const viewer = window.viewerHarness.get("one").ref.current;
      await viewer.scrollToInstance(instance);
      await viewer.highlightInstance(instance);
    },
    { instance },
  );
  const labels = page.locator("[data-mokly-label-layer] button");
  await expect(labels).toHaveCount(1);
  // The one label stands over the named variant's frame: its centre lies on
  // the frame's span, and it hangs at most its height above the frame.
  const frame = (await page.locator(shown).boundingBox())!;
  const label = (await labels.boundingBox())!;
  const centre = label.x + label.width / 2;
  expect(centre).toBeGreaterThanOrEqual(frame.x);
  expect(centre).toBeLessThanOrEqual(frame.x + frame.width);
  expect(label.y).toBeGreaterThanOrEqual(frame.y - label.height - 4);
  expect(label.y).toBeLessThanOrEqual(frame.y + frame.height);
  const outcomes = await page.evaluate(
    async ({ instance, outside }) => {
      const viewer = window.viewerHarness.get("one").ref.current;
      const mismatched = { ...instance, screenPath: outside };
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
    },
    { instance, outside: canvas ? "home" : "pane/default" },
  );
  expect(outcomes).toEqual(["rejected", "rejected"]);
}
