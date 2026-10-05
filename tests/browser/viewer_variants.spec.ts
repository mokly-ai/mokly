import type { Page } from "@playwright/test";
import { expect, test } from "@playwright/test";

import type { InstanceRef, ViewerSelection } from "@mokly/viewer";
import { catalogueComponentVariants } from "@mokly/viewer/data";

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
        defaultSelection: { screenPath: "pane", viewport: "desktop" },
      }),
    { cross, controlled },
  );
  await expect(
    page
      .getByRole("navigation", { name: "Saved variants" })
      .getByRole("link", { name: "Default", exact: true }),
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
    await expect(
      page
        .frameLocator('iframe[data-workspace-frame="desktop"]')
        .getByText("Second content"),
    ).toBeVisible();
    await page.evaluate(() =>
      window.viewerHarness
        .get("one")
        .ref.current.select({ screenPath: "pane/default" }),
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
      expect.objectContaining({ screenPath: "pane/second" }),
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

  test(`${adapter} inspects only the selected non-default variant`, async ({
    page,
  }) => {
    await openViewer(page, cross);
    const component = fixture.catalogue.components.find(
      (entry) => entry.path === "pane",
    )!;
    const variant = catalogueComponentVariants(
      fixture.catalogue,
      component.path,
    ).find((entry) => entry.path === "pane/second")!;
    const view = variant.views.find(
      (entry) => entry.viewport === "desktop" && entry.colorScheme === "light",
    )!;
    if (view.usage.status !== "ready") throw new Error("Expected ready usage");
    const instance: InstanceRef = {
      screenPath: "pane/second",
      viewport: "desktop",
      colorScheme: "light",
      key: view.usage.instances[0]!.key,
    };
    await page.evaluate(
      async ({ instance }) => {
        const viewer = window.viewerHarness.get("one").ref.current;
        viewer.select({ screenPath: "pane/second" });
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
      const mismatched = { ...instance, screenPath: "pane/default" };
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
