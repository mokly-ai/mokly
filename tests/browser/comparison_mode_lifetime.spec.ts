import { expect, test, type Page } from "@playwright/test";

import { startBranchHost, type BranchHost } from "./branch_hosts.js";
import { PANE_SOURCE } from "./comparison_actions.js";
import { comparisonModeCatalogue } from "./comparison_mode_fixture.js";
import { chooseVariant } from "./workspace_actions.js";

const side = (page: Page) =>
  page.getByRole("button", { name: "Side by side", exact: true });

async function compared(page: Page, variant: string) {
  await expect(side(page)).toHaveAttribute("aria-pressed", "true");
  await expect(
    page.locator("[data-diff-stage] .mb-pane--after iframe"),
  ).toHaveAttribute(
    PANE_SOURCE,
    new RegExp(`/action/${variant}/index\\.mobile\\.html$`),
  );
}

for (const kind of ["serve", "export"] as const) {
  for (const width of [1280, 390]) {
    test.describe(`${kind} ${width}px comparison mode`, () => {
      let host: BranchHost;
      test.beforeEach(async () => {
        host = await startBranchHost(kind, comparisonModeCatalogue);
      });
      test.afterEach(async () => {
        await host?.close();
      });

      test("a cold entry keeps Side by side through changed and unchanged siblings", async ({
        page,
      }) => {
        await page.setViewportSize({ width, height: 900 });
        await page.goto(`${host.url}/view/action/default/?viewport=mobile`);
        await side(page).click();
        await compared(page, "default");
        const evidenceBefore =
          kind === "serve"
            ? ((
                await (
                  await page.request.get(`${host.url}/__mokly/catalogue.json`)
                ).json()
              ).revision.evidence as number)
            : undefined;
        await chooseVariant(page, "Secondary");
        await compared(page, "secondary");
        if (evidenceBefore !== undefined) {
          const current = await (
            await page.request.get(`${host.url}/__mokly/catalogue.json`)
          ).json();
          expect(current.revision.evidence).toBeGreaterThan(evidenceBefore);
        }
        await chooseVariant(page, "Quiet");
        await expect(page.locator("[data-diff-stage]")).toBeHidden();
        await expect(
          page.locator("[data-workspace-variant-status]"),
        ).toHaveText("Quiet · Unmodified");
        await chooseVariant(page, "Default");
        await compared(page, "default");
        await page.goBack();
        await expect(page.locator("[data-diff-stage]")).toBeHidden();
        await page.goBack();
        await compared(page, "secondary");
        await page.goForward();
        await expect(page.locator("[data-diff-stage]")).toBeHidden();
        await page.goForward();
        await compared(page, "default");
        if (width < 900)
          await page
            .getByRole("button", { name: "Open catalogue navigation" })
            .click();
        await page.locator('a[data-nav-row][data-entry-id="other"]').click();
        await expect(
          page.getByRole("button", { name: "Current", exact: true }),
        ).toHaveAttribute("aria-pressed", "true");
        await expect(page.locator("[data-diff-stage]")).toBeHidden();
      });

      test("a fresh eligible load honors the comparison query", async ({
        page,
      }) => {
        await page.setViewportSize({ width, height: 900 });
        await page.goto(
          `${host.url}/view/action/default/?viewport=mobile&comparison=side`,
        );
        await compared(page, "default");
        await page.reload();
        await compared(page, "default");
        await page.goto(
          `${host.url}/view/action/quiet/?viewport=mobile&comparison=side`,
        );
        await expect(page.locator("html")).toHaveAttribute(
          "data-mokly-hydrated",
          "",
        );
        await expect(
          page
            .frameLocator('[data-workspace-frame="mobile"]')
            .getByRole("button", { name: "Quiet", exact: true }),
        ).toBeVisible();
        await expect(page.locator("[data-diff-stage]")).toBeHidden();
        await chooseVariant(page, "Default");
        await expect(
          page.getByRole("button", { name: "Current", exact: true }),
        ).toHaveAttribute("aria-pressed", "true");
      });
    });
  }
}
