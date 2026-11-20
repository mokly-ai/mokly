import { expect, test } from "@playwright/test";

import { productRun, productSchemes, productViewports } from "./product-runs";
import { workspaceOverlayTests } from "./workspace-overlays";

/**
 * The product checks that span families or stand alone: the recovery of an
 * unmatched path, the slug fields of the account and settings forms, and the
 * shared overlays of `workspace-overlays.ts`. Each other product spec on disk
 * holds one area: `product-account.spec.ts`, `product-onboarding.spec.ts`,
 * `product-refusals.spec.ts`, `product-settings.spec.ts` and
 * `product-row-menu.spec.ts`.
 */

for (const viewport of productViewports)
  for (const scheme of productSchemes) {
    const { url, label, size } = productRun(viewport, scheme);

    test(
      "unmatched paths keep one data-free recovery: " + label,
      async ({ page }) => {
        await page.setViewportSize(size);
        for (const state of [undefined, "empty", "loading", "error"] as const) {
          await page.goto(
            url("product/recovery/not-found" + (state ? "/" + state : "")),
          );
          await expect(
            page.getByRole("heading", { name: "Page not found" }),
          ).toBeVisible();
          await expect(
            page.getByRole("link", { name: "Open dashboard" }),
          ).toHaveCount(1);
          await expect(
            page.locator('[data-testid^="firna-button-"]'),
          ).toHaveCount(1);
          await expect(
            page.locator(
              ".review-account, .fo-top-bar, iframe, [aria-busy='true']",
            ),
          ).toHaveCount(0);
          await expect(page.locator("main")).not.toContainText("404");
          await expect(page.locator("main")).not.toContainText("/_sitemap");
        }
      },
    );

    test(
      "slug fields prevent keyboard rewriting without changing prose fields: " +
        label,
      async ({ page }) => {
        await page.setViewportSize(size);
        for (const [id, field] of [
          ["product/account/create-workspace", "Workspace slug"],
          ["product/account/choose-repository", "Project slug"],
          ["product/settings/workspace/slug", "Workspace slug"],
          ["product/settings/project/slug", "Project slug"],
        ] as const) {
          await page.goto(url(id));
          const slug = page.getByRole("textbox", { name: field, exact: true });
          await expect(slug, id).toHaveAttribute("autocapitalize", "none");
          await expect(slug, id).toHaveAttribute("autocorrect", "off");
          await expect(slug, id).toHaveAttribute("spellcheck", "false");
        }

        await page.goto(url("product/account/create-workspace"));
        const name = page.getByRole("textbox", {
          name: "Workspace name",
          exact: true,
        });
        await expect(name).toHaveAttribute("autocapitalize", "sentences");
        await expect(name).toHaveAttribute("autocorrect", "on");
        await expect(name).toHaveAttribute("spellcheck", "true");
      },
    );

    workspaceOverlayTests({ viewport, label, size, url });
  }
