import { expect, test } from "@playwright/test";

import type { ViewerSelection } from "@mokly/viewer";

import {
  HISTORICAL_ROUTE,
  historicalSelectionFixture,
} from "./historical_selection_acceptance_fixture.js";
import type {} from "./viewer_harness.js";

let fixture: Awaited<ReturnType<typeof historicalSelectionFixture>>;
test.beforeAll(async () => {
  fixture = await historicalSelectionFixture();
});
test.afterAll(async () => {
  await fixture?.close();
});

for (const controlled of [false, true]) {
  test(`${controlled ? "controlled" : "uncontrolled"} historical selection preserves the exact version of a shared screen ID`, async ({
    page,
  }) => {
    await page.goto(fixture.host.url);
    await page.waitForFunction(() => Boolean(window.viewerHarness));
    await page.evaluate(
      ({ catalogueJson, controlled }) => {
        const catalogue: unknown = JSON.parse(catalogueJson);
        window.viewerHarness.start("history", {
          controlled,
          source: catalogue,
          defaultSelection: {
            screenId: "home",
            view: "changes",
            viewport: "mobile",
          },
        });
      },
      { catalogueJson: JSON.stringify(fixture.catalogue), controlled },
    );
    const root = page.locator("#history");
    await expect(root.locator("h2")).toHaveText("Current home");
    await root
      .locator(`a[data-nav-row][data-route="${HISTORICAL_ROUTE}"]`)
      .click();
    await expect
      .poll(() =>
        page.evaluate(
          () =>
            window.viewerHarness
              .get("history")
              .events.filter(({ name }) => name === "selection").length,
        ),
      )
      .toBe(1);
    const proposal = await page.evaluate(
      () =>
        window.viewerHarness
          .get("history")
          .events.find(({ name }) => name === "selection")!
          .value as ViewerSelection,
    );
    expect(proposal).toEqual(
      expect.objectContaining({
        screenId: "home",
        snapshotId: fixture.snapshotId,
        view: "changes",
      }),
    );
    if (controlled) {
      await expect(root.locator("h2")).toHaveText("Current home");
      await expect(root.locator("[data-mokly-preview]")).toHaveCount(0);
      await page.evaluate(
        (selection) =>
          window.viewerHarness.get("history").setSelection(selection),
        proposal,
      );
    }
    await expect(root.locator("h2")).toHaveText("Historical home");
    await expect(root.locator("[data-workspace-status]")).toHaveText("Removed");
    const mobile = root.locator(
      "[data-mokly-preview] .mbk-frame-mobile iframe",
    );
    await expect(mobile.contentFrame().locator("h1")).toHaveText(
      "Historical mobile content",
    );
    await expect(mobile).toHaveAttribute("sandbox", "allow-same-origin");
    const hostAddress = page.url();
    await mobile.contentFrame().getByRole("link", { name: "Old link" }).click();
    await expect(mobile.contentFrame().locator("h1")).toHaveText(
      "Historical mobile content",
    );
    expect(page.url()).toBe(hostAddress);
    await expect(root.locator(".mbk-diff-toolbar")).toHaveCount(0);
    await expect(
      root.locator(`a[data-nav-row][data-route="${HISTORICAL_ROUTE}"]`),
    ).toHaveAttribute("aria-current", "page");
    expect(
      await page.evaluate(
        () =>
          window.viewerHarness
            .get("history")
            .events.find(({ name }) => name === "navigate")?.value,
      ),
    ).toEqual(
      expect.objectContaining({
        screenId: "home",
        route: HISTORICAL_ROUTE,
        snapshotId: fixture.snapshotId,
      }),
    );

    await root.getByLabel("Viewport", { exact: true }).selectOption("desktop");
    const axisProposal = await page.evaluate(
      () =>
        window.viewerHarness
          .get("history")
          .events.filter(({ name }) => name === "selection")
          .at(-1)!.value as ViewerSelection,
    );
    expect(axisProposal.snapshotId).toBe(fixture.snapshotId);
    if (controlled)
      await page.evaluate(
        (selection) =>
          window.viewerHarness.get("history").setSelection(selection),
        axisProposal,
      );
    await expect(
      root
        .locator("[data-mokly-preview] .mbk-frame-desktop iframe")
        .contentFrame()
        .locator("h1"),
    ).toHaveText("Historical desktop content");

    await page.evaluate(() =>
      window.viewerHarness
        .get("history")
        .ref.current.select({ screenId: "home" }),
    );
    const currentProposal = await page.evaluate(
      () =>
        window.viewerHarness
          .get("history")
          .events.filter(({ name }) => name === "selection")
          .at(-1)!.value as ViewerSelection,
    );
    expect(currentProposal.snapshotId).toBeUndefined();
    if (controlled)
      await page.evaluate(
        (selection) =>
          window.viewerHarness.get("history").setSelection(selection),
        currentProposal,
      );
    await expect(root.locator("h2")).toHaveText("Current home");
    await expect(root.locator("[data-mokly-preview]")).toHaveCount(0);
    expect(
      await page.evaluate(() =>
        window.viewerHarness
          .get("history")
          .events.filter(({ name }) => name === "error"),
      ),
    ).toEqual([]);
  });
}
