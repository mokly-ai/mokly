import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

import type { InstanceRef, ViewerSelection } from "@mokly/viewer";

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
