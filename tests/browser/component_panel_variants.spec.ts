import { expect, test } from "@playwright/test";

import { componentDesignUrl } from "./component_design_fixture.js";

const variants = ["tree", "outline", "groups", "ledger"] as const;

for (const viewport of ["desktop", "mobile"] as const) {
  test.describe(`${viewport} Components panel variants`, () => {
    test.use({
      viewport:
        viewport === "desktop"
          ? { width: 1440, height: 1000 }
          : { width: 390, height: 844 },
    });

    test("render unique instances, selection, and hidden status", async ({
      page,
    }) => {
      for (const variant of variants) {
        await page.goto(
          componentDesignUrl(
            `inspection/components-panel/${variant}`,
            viewport,
          ),
        );
        const inspector = page.getByRole("region", {
          name: "Inspector",
          exact: true,
        });
        await expect(
          inspector.locator(':scope > details[data-panel="components"][open]'),
        ).toHaveCount(1);
        const instances = inspector.locator("[data-instance-id]");
        await expect(instances).toHaveCount(4);
        expect(
          await instances.evaluateAll((links) =>
            links.map((link) => link.getAttribute("data-instance-id")).sort(),
          ),
        ).toEqual(["footer-action", "help", "main", "toolbar-action"]);
        await expect(
          inspector.locator('[data-instance-id="footer-action"]'),
        ).toHaveAttribute("aria-current", "true");
        await expect(inspector.getByText("No visible region")).toBeAttached();
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= window.innerWidth,
          ),
        ).toBe(true);
      }
    });

    test("native disclosures keep nested instances reachable", async ({
      page,
    }) => {
      await page.goto(
        componentDesignUrl("inspection/components-panel/tree", viewport),
      );
      const nested = page.locator('[data-instance-id="toolbar-action"]');
      await expect(nested).toBeHidden();
      const disclosure = page.getByText("1 nested instance", { exact: true });
      await disclosure.focus();
      await expect(disclosure).toBeFocused();
      await page.keyboard.press("Space");
      await expect(nested).toBeVisible();

      await page.goto(
        componentDesignUrl("inspection/components-panel/outline", viewport),
      );
      const openNested = page.locator('[data-instance-id="toolbar-action"]');
      await expect(openNested).toBeVisible();
      await page.getByText("1 nested instance", { exact: true }).click();
      await expect(openNested).toBeHidden();
      await expect(page.locator('[data-instance-id="main"]')).toBeVisible();
    });
  });
}

test("desktop ledger aligns every owner with the Inside column", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(
    componentDesignUrl("inspection/components-panel/ledger", "desktop"),
  );
  const insideHeading = page.locator(".ce-panel-ledger-head > span").nth(2);
  await expect(insideHeading).toHaveText("Inside");
  const headingX = await insideHeading.evaluate(
    (element) => element.getBoundingClientRect().x,
  );
  const owners = page.locator(".ce-panel-ledger-owner");
  await expect(owners).toHaveCount(4);
  for (const owner of await owners.all()) {
    const ownerX = await owner.evaluate(
      (element) => element.getBoundingClientRect().x,
    );
    expect(Math.abs(ownerX - headingX)).toBeLessThanOrEqual(1);
  }
});
