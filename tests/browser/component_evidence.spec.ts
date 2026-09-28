import { expect, test } from "@playwright/test";

import { componentDesignUrl } from "./component_design_fixture.js";

for (const viewport of ["desktop", "mobile"] as const) {
  test.describe(`${viewport} comparison evidence`, () => {
    test.use({
      viewport:
        viewport === "desktop"
          ? { width: 1440, height: 1000 }
          : { width: 390, height: 844 },
    });

    test("comparison facts appear only in Details when evidence exists", async ({
      page,
    }) => {
      for (const route of [
        "pages/comparison",
        "pages/stacked/overlay",
        "pages/stacked/difference",
        "pages/stacked/overlay-tall",
        "pages/affected",
        "controls/states/comparison",
        "states/removed",
        "states/removed-consumer",
        "inspection/direct-change",
      ]) {
        await page.goto(componentDesignUrl(route, viewport));
        await expect(
          page.locator(".ce-preview-pane .ce-comparison-evidence"),
        ).toHaveCount(0);
        await expect(page.locator(".ce-change-context")).toHaveCount(0);
        const details = page.getByRole("region", {
          name: "Details",
          exact: true,
        });
        if (!(await details.isVisible()))
          await page
            .getByRole("button", { name: "Details", exact: true })
            .click();
        await expect(details).toContainText("Comparison details");
        await expect(page.locator(".ce-comparison-evidence")).toHaveCount(1);
        await expect(page.locator(".ce-comparison-evidence")).not.toContainText(
          "corners and spacing",
        );
        if (route === "states/removed-consumer")
          await expect(
            page.getByRole("region", { name: "Details", exact: true }),
          ).toContainText(
            "A former screen that is no longer in the catalogue.",
          );
      }
      for (const route of [
        "overview",
        "controls/editing/edited",
        "states/empty",
      ]) {
        await page.goto(componentDesignUrl(route, viewport));
        await expect(page.locator(".ce-comparison-evidence")).toHaveCount(0);
      }
    });

    test("screen comparison names the instance and its before/current props", async ({
      page,
    }) => {
      await page.goto(componentDesignUrl("inspection/direct-change", viewport));
      await expect(page.locator(".ce-change-context")).toHaveCount(0);
      await page.getByRole("button", { name: "Details", exact: true }).click();
      const evidence = page.locator(".ce-comparison-evidence");
      await expect(evidence).toContainText("Action · Footer action");
      await expect(evidence.getByRole("table")).toContainText("Continue");
      await expect(evidence.getByRole("table")).toContainText("Get started");
      await expect(
        evidence.getByRole("link", { name: "Action" }),
      ).toHaveAttribute("data-mokly-link", "design-component-affected");
      await page.getByRole("button", { name: "Props", exact: true }).click();
      await expect(page.getByLabel("Supplied props")).toContainText(
        "Get started",
      );
      await expect(page.locator(".ce-prop-change")).toHaveCount(0);
    });

    test("disabled highlighting explains the specific reason", async ({
      page,
    }) => {
      for (const [route, reason] of [
        ["states/empty", "No registered components in this view"],
        ["states/unavailable", "Component inspection is unavailable"],
        [
          "states/removed-consumer",
          "Highlighting is unavailable for removed screens",
        ],
      ]) {
        await page.goto(componentDesignUrl(route!, viewport));
        const toggle = page.getByRole("switch", {
          name: "Highlight components",
        });
        await expect(toggle).toBeDisabled();
        await expect(toggle).toHaveAccessibleDescription(reason!);
        await expect(page.locator(".ce-highlight-control")).toHaveAttribute(
          "title",
          reason!,
        );
      }
      await page.goto(componentDesignUrl("inspection/details", viewport));
      await expect(
        page.getByRole("switch", { name: "Highlight components" }),
      ).toBeEnabled();
    });

    test("highlight chips have clear separation from intact outlines", async ({
      page,
    }) => {
      for (const route of [
        "inspection/highlight",
        "inspection/nested",
        "inspection/consumer",
      ]) {
        await page.goto(componentDesignUrl(route, viewport));
        await page
          .getByRole("switch", { name: "Highlight components" })
          .check();
        const regions = page.locator(
          ".ce-preview-view:visible .ce-region, .ce-preview-view:visible .ce-single-highlight",
        );
        expect(await regions.count()).toBeGreaterThan(0);
        for (const region of await regions.all()) {
          const outline = (await region.boundingBox())!;
          const label = (await region.locator(":scope > span").boundingBox())!;
          expect(outline.y - (label.y + label.height)).toBeGreaterThanOrEqual(
            4,
          );
          expect(label.x).toBeGreaterThanOrEqual(outline.x + 4);
          const radii = await region
            .locator(":scope > span")
            .evaluate((node) => {
              const style = getComputedStyle(node);
              return [
                style.borderBottomLeftRadius,
                style.borderBottomRightRadius,
              ];
            });
          expect(radii.every((radius) => parseFloat(radius) > 0)).toBe(true);
        }
      }
    });

    test("entry badges distinguish additions, edits, removals, and saved values", async ({
      page,
    }) => {
      for (const [route, status] of [
        ["pages/affected", "Changed"],
        ["inspection/direct-change", "Changed"],
        ["states/removed", "Changed"],
        ["states/removed-consumer", "Removed"],
        ["states/unused", "Unmodified"],
        ["controls/editing/edited", "Unmodified"],
        ["states/additions/added", "Added"],
      ]) {
        await page.goto(componentDesignUrl(route!, viewport));
        await expect(
          page.locator(".mbk-screen-head .ce-change-status"),
        ).toHaveText(status!);
      }
      const preview = page.locator(".ce-preview-view:visible");
      await expect(
        page.getByRole("group", { name: "Comparison mode" }),
      ).toHaveCount(0);
      await expect(preview.locator(".mbk-pane-missing")).toHaveCount(0);
      await expect(preview.locator(".ce-badge")).toHaveText("New");
      await expect(
        page.locator(
          viewport === "desktop" ? ".mbk-nav-filter-count" : ".ce-change-count",
        ),
      ).toHaveText("1");
      if (viewport === "desktop")
        await expect(page.locator(".mbk-nav-scroll a")).toHaveText("Badge");
    });
  });
}
