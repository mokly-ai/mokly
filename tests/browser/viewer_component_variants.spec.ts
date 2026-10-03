import { expect, test } from "@playwright/test";

import type { InstanceRef, ViewerSelection } from "@mokly/viewer";
import { catalogueComponentVariants } from "@mokly/viewer/data";

import {
  openViewer,
  startSuite,
  stopSuite,
  suiteState,
} from "./viewer_variants_fixture.js";

test.beforeAll(startSuite);

test.afterAll(stopSuite);

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
    await expect(
      page
        .frameLocator('iframe[data-workspace-frame="desktop"]')
        .getByText("Second content"),
    ).toBeVisible();
    await page.evaluate(() =>
      window.viewerHarness
        .get("one")
        .ref.current.select({ screenId: "pane-default" }),
    );
    await expect(first).toHaveAttribute("aria-current", "page");
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
        value: { screenId: "pane-second" },
      },
      {
        name: "selection",
        value: expect.objectContaining({
          screenId: "pane-second",
        }),
      },
      {
        name: "navigate",
        value: { screenId: "pane-default" },
      },
      {
        name: "selection",
        value: expect.objectContaining({
          screenId: "pane-default",
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
      expect.objectContaining({ screenId: "pane-second" }),
    );
    await page.evaluate((selection) => {
      window.viewerHarness
        .get("one")
        .setSelection(selection as ViewerSelection);
    }, proposal);
    await expect(second).toHaveAttribute("aria-current", "page");
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
    ).toEqual({ screenId: "pane-second" });
  });

  test(`${adapter} treats an unknown imperative entry as unavailable`, async ({
    page,
  }) => {
    await openViewer(page, cross);
    await page.evaluate(() => {
      window.viewerHarness.get("one").ref.current.select({
        screenId: "missing",
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

  test(`${adapter} inspects only the selected non-default variant`, async ({
    page,
  }) => {
    await openViewer(page, cross);
    const component = suiteState.fixture.catalogue.components.find(
      (entry) => entry.id === "pane",
    )!;
    const variant = catalogueComponentVariants(
      suiteState.fixture.catalogue,
      component.id,
    ).find((entry) => entry.id === "pane-second")!;
    const view = variant.views.find(
      (entry) => entry.viewport === "desktop" && entry.colorScheme === "light",
    )!;
    if (view.usage.status !== "ready") throw new Error("Expected ready usage");
    const instance: InstanceRef = {
      screenId: "pane-second",
      viewport: "desktop",
      colorScheme: "light",
      key: view.usage.instances[0]!.key,
    };
    await page.evaluate(
      async ({ instance }) => {
        const viewer = window.viewerHarness.get("one").ref.current;
        viewer.select({ screenId: "pane-second" });
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
      const mismatched = { ...instance, screenId: "pane-default" };
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
