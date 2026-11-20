import { expect, test } from "@playwright/test";

import { productRun, productSchemes, productViewports } from "./product-runs";
import { settingsDocumentViolations } from "./settings-document-policy";

/**
 * A token row's actions behind its three-dot trigger: the popover on desktop,
 * the sheet on mobile and the revoke confirmation, and the settings overlay
 * policy's rejection of a damaged row menu.
 */

for (const viewport of productViewports)
  for (const scheme of productSchemes) {
    const { url, label, size } = productRun(viewport, scheme);

    test(
      "a token row keeps its own actions behind one three-dot trigger: " +
        label,
      async ({ page }) => {
        await page.setViewportSize(size);
        // The mobile sheet leaves the layer beneath it hidden from assistive
        // technology, so only there the trigger is found among hidden elements.
        const trigger = page.getByRole("button", {
          name: "Actions for GitHub Actions",
          exact: true,
          includeHidden: viewport === "mobile",
        });
        await page.goto(url("product/settings/tokens"));
        await expect(trigger).toBeVisible();
        await expect(trigger).toHaveAttribute("aria-haspopup", "menu");
        await expect(trigger).toHaveAttribute("aria-expanded", "false");
        await expect(trigger).toHaveText("");
        await expect(page.getByRole("menu")).toHaveCount(0);
        await page.goto(url("product/settings/tokens/revoke/menu"));
        await expect(trigger).toHaveAttribute("aria-expanded", "true");
        const menu = page.getByRole("menu", {
          name: "Actions for GitHub Actions",
        });
        await expect(menu).toBeVisible();
        await expect(
          menu.getByRole("menuitem", { name: "Revoke", exact: true }),
        ).toBeVisible();
        const surface = page.getByRole("dialog", {
          name: "Actions for GitHub Actions",
        });
        if (viewport === "desktop") {
          // Anchored below the trigger with its end edge on the trigger's. The
          // named dialog sits inside the package's surface chrome, so the
          // chrome's box is the one the placement lines up.
          await expect(surface).not.toHaveAttribute("aria-modal", "true");
          const anchor = (await trigger.boundingBox())!;
          const popover = (await surface.locator("xpath=..").boundingBox())!;
          expect(popover.y).toBeGreaterThan(anchor.y + anchor.height);
          expect(
            Math.abs(popover.x + popover.width - (anchor.x + anchor.width)),
          ).toBeLessThan(2);
        } else {
          // A bottom sheet over the whole layer, titled with the row's name.
          await expect(surface).toHaveAttribute("aria-modal", "true");
          await expect(
            surface.getByText("GitHub Actions", { exact: true }),
          ).toBeVisible();
          await expect(
            surface.getByRole("button", { name: "Cancel", exact: true }),
          ).toBeVisible();
          const sheet = (await surface.boundingBox())!;
          expect(Math.round(sheet.y + sheet.height)).toBe(size.height);
          expect(Math.round(sheet.width)).toBe(size.width);
        }
        expect(await page.evaluate(settingsDocumentViolations)).toEqual([]);
        await page.goto(url("product/settings/tokens/revoke"));
        await expect(
          page.getByText("Revoke GitHub Actions?", { exact: true }),
        ).toBeVisible();
        await expect(
          page.getByRole("button", { name: "Revoke token", exact: true }),
        ).toBeEnabled();
        await page.goto(url("product/settings/tokens/revoke/loading"));
        // The working control refuses a second press through its busy state
        // and keeps focus, as Write in progress in `folio-chrome.md` defines.
        await expect(
          page.getByRole("button", { name: "Revoking…", exact: true }),
        ).toHaveAttribute("aria-busy", "true");
        expect(await page.evaluate(settingsDocumentViolations)).toEqual([]);
      },
    );

    test(
      "the settings overlay policy rejects a damaged row menu: " + label,
      async ({ page }) => {
        await page.setViewportSize(size);
        await page.goto(url("product/settings/tokens/revoke/menu"));
        // Each damage finds the open menu by its name: the popover in its row
        // on desktop, and the sheet in the modal layer on mobile.
        const damaged = async (damage: () => void) => {
          await page.reload();
          await page.evaluate(damage);
          return page.evaluate(settingsDocumentViolations);
        };
        expect(
          await damaged(() => {
            document
              .querySelector(
                '[role="dialog"][aria-label="Actions for GitHub Actions"]',
              )!
              .appendChild(document.createElement("div"))
              .setAttribute("role", "dialog");
          }),
        ).toContain("overlay opens no layer of its own");
        expect(
          await damaged(() => {
            const menu = document.querySelector(
              '[role="dialog"][aria-label="Actions for GitHub Actions"]',
            )!;
            document.querySelector("main")!.appendChild(menu.cloneNode(true));
          }),
        ).toContain("unexpected overlay");
        expect(
          await damaged(() => {
            const menu = document.querySelector(
              '[role="dialog"][aria-label="Actions for GitHub Actions"]',
            )!;
            menu.parentElement!.appendChild(menu.cloneNode(true));
          }),
        ).toContain("one overlay at a time");
        if (viewport === "desktop")
          expect(
            await damaged(() => {
              document
                .querySelector(
                  '[role="dialog"][aria-label="Actions for GitHub Actions"]',
                )!
                .setAttribute("aria-modal", "true");
            }),
          ).toContain("row menu popover must stay non-modal");
        else
          expect(
            await damaged(() => {
              document
                .querySelector(
                  '[role="dialog"][aria-label="Actions for GitHub Actions"]',
                )!
                .removeAttribute("aria-modal");
            }),
          ).toContain("dialog must be modal");
      },
    );
  }
