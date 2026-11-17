import { expect, test } from "@playwright/test";

import { exampleToken } from "../fixtures/product-states";

import { productRun, productSchemes, productViewports } from "./product-runs";
import { settingsDocumentViolations } from "./settings-document-policy";

/**
 * The settings dialog over its blank stage, the one heading of each pane, the
 * confirmations over a pane with the token secret shown once, and the members
 * pane. The token row's menu is checked in `product-row-menu.spec.ts`.
 */

for (const viewport of productViewports)
  for (const scheme of productSchemes) {
    const { url, label, size } = productRun(viewport, scheme);

    test(
      "settings opens over a blank stage and returns to its index: " + label,
      async ({ page }) => {
        await page.setViewportSize(size);
        await page.goto(url("product/settings/project"));
        await expect(page.locator("[data-mkc-screen]")).toHaveAttribute(
          "data-mkc-screen",
          "product/settings/project",
        );
        expect(await page.evaluate(settingsDocumentViolations)).toEqual([]);
        if (viewport === "desktop") {
          await expect(page.locator("[role=dialog]")).toHaveCount(1);
          const stage = page.locator(".fo-settings-backdrop");
          await expect(stage.locator(".fo-stage-canvas")).toBeVisible();
          expect((await stage.innerText()).trim()).toBe("");
          await expect(stage.locator("a, button, main, h1")).toHaveCount(0);
          await page
            .getByRole("navigation", { name: "Settings sections" })
            .getByRole("link", { name: "Publishing tokens", exact: true })
            .click();
          await expect(page.locator("[data-mkc-screen]")).toHaveAttribute(
            "data-mkc-screen",
            "product/settings/tokens",
          );
        } else {
          await expect(page.locator("[role=dialog]")).toHaveCount(0);
          await expect(page.locator(".fo-settings-backdrop")).toHaveCount(0);
          await page
            .getByRole("link", { name: "Settings", exact: true })
            .click();
          await expect(page.locator("[data-mkc-screen]")).toHaveAttribute(
            "data-mkc-screen",
            "product/settings/sections",
          );
          await page
            .locator(".content-list-row")
            .filter({ hasText: "Publishing tokens" })
            .getByRole("link")
            .click();
          await expect(page.locator("[data-mkc-screen]")).toHaveAttribute(
            "data-mkc-screen",
            "product/settings/tokens",
          );
        }
      },
    );

    test(
      "each settings pane keeps one heading inside one frame: " + label,
      async ({ page }) => {
        await page.setViewportSize(size);
        for (const [pane, heading] of [
          ["sections", "Settings"],
          ["account", "Account"],
          ["workspace", "Workspace"],
          ["github", "GitHub accounts"],
          ["members", "Members"],
          ["billing", "Billing"],
          ["project", "Project"],
          ["tokens", "Publishing tokens"],
          ["access", "Access"],
          ["danger", "Delete project"],
        ] as const) {
          await page.goto(url("product/settings/" + pane));
          expect(await page.evaluate(settingsDocumentViolations)).toEqual([]);
          await expect(
            page.getByRole("heading", { level: 1, name: heading }),
          ).toBeVisible();
          await expect(page.locator("main")).toHaveCount(1);
        }
      },
    );

    test(
      "settings confirmations open over the pane and the secret is revealed once: " +
        label,
      async ({ page }) => {
        await page.setViewportSize(size);
        // The danger pane is itself the confirmation, so it opens no modal.
        await page.goto(url("product/settings/danger/empty"));
        await expect(
          page.getByRole("button", { name: "Delete project", exact: true }),
        ).toBeDisabled();
        await page.goto(url("product/settings/danger"));
        await expect(
          page.getByRole("textbox", { name: "Type Mokly Cloud to confirm" }),
        ).toHaveValue("Mokly Cloud");
        await expect(
          page.getByRole("button", { name: "Delete project", exact: true }),
        ).toBeEnabled();
        await expect(
          page.getByText(/All publications in this project become unavailable/),
        ).toBeVisible();
        const frames = viewport === "desktop" ? 1 : 0;
        await page.goto(url("product/settings/project"));
        await expect(page.locator("[role=dialog]")).toHaveCount(frames);
        await page.goto(url("product/settings/project/visibility"));
        await expect(
          page.getByText("Make Mokly Cloud public?", { exact: true }),
        ).toBeVisible();
        await expect(page.locator("[role=dialog]")).toHaveCount(frames + 1);
        expect(await page.evaluate(settingsDocumentViolations)).toEqual([]);
        // The list itself never holds the secret; only the modal that made it.
        await page.goto(url("product/settings/tokens"));
        await expect(
          page.getByText("mkc_2600…", { exact: true }),
        ).toBeVisible();
        for (const state of ["", "empty", "loading", "error"]) {
          await page.goto(
            url("product/settings/tokens" + (state ? "/" + state : "")),
          );
          await expect(
            page.getByText(exampleToken, { exact: true }),
          ).toHaveCount(0);
        }
        for (const state of ["reveal", "copy"]) {
          await page.goto(url("product/settings/tokens/create/" + state));
          await expect(
            page.getByText(exampleToken, { exact: true }),
          ).toHaveCount(1);
          expect(await page.evaluate(settingsDocumentViolations)).toEqual([]);
        }
      },
    );

    test(
      "member management preserves the selected identity: " + label,
      async ({ page }) => {
        await page.setViewportSize(size);
        await page.goto(url("product/settings/members"));
        await expect(page.getByText("sam@example.com")).toBeVisible();
        await expect(
          page.getByRole("heading", { name: "Manage Sam" }),
        ).toBeVisible();
        await expect(
          page.getByRole("link", { name: "Remove Sam", exact: true }),
        ).toBeVisible();
        await page.goto(url("product/settings/members/remove"));
        await expect(
          page.getByText("Remove Sam?", { exact: true }),
        ).toBeVisible();
        await expect(
          page.getByRole("button", { name: "Remove Sam", exact: true }),
        ).toBeEnabled();
        expect(await page.evaluate(settingsDocumentViolations)).toEqual([]);
        await page.goto(url("product/settings/members/empty"));
        await expect(page.getByText("No pending invitations.")).toBeVisible();
        await page.goto(url("product/settings/members/loading"));
        await expect(page.locator("[aria-busy=true]").first()).toBeVisible();
        await page.goto(url("product/settings/members/error"));
        await expect(
          page.getByRole("heading", { name: "Members couldn’t load" }),
        ).toBeVisible();
      },
    );
  }
