/**
 * Browser checks for the two surfaces the workspace drawings open over a page:
 * the repository select's list and a GitHub account's row menu. Their place is
 * the point of the drawing, so it is measured rather than read from markup.
 * `product.spec.ts` registers them once per viewport and scheme.
 */

import { expect, test } from "@playwright/test";

import { githubAccounts } from "../fixtures/product";

import { settingsDocumentViolations } from "./settings-document-policy";

/** One run of the checks: a page size, its label, and the page addresses. */
export interface OverlayRun {
  viewport: "desktop" | "mobile";
  label: string;
  size: { width: number; height: number };
  url: (id: string) => string;
}

export function workspaceOverlayTests({
  viewport,
  label,
  size,
  url,
}: OverlayRun) {
  test(
    "the open repository select hangs beneath its field, as wide as it: " +
      label,
    async ({ page }) => {
      await page.setViewportSize(size);
      await page.goto(url("product/account/choose-repository/open"));
      const trigger = page
        .getByTestId("firna-selector")
        .locator('[aria-haspopup="listbox"]');
      const list = page.getByTestId("firna-options-list");
      await expect(list).toBeVisible();
      await expect(list.getByRole("option")).toHaveCount(
        githubAccounts.reduce(
          (total, account) => total + account.repositories.length,
          0,
        ),
      );
      for (const account of githubAccounts)
        await expect(
          list.getByText(account.name, { exact: true }),
        ).toBeVisible();
      await expect(
        list.getByRole("textbox", { name: "Search options" }),
      ).toBeVisible();
      // The package's surface chrome around the list is what the live portal
      // places, so its box is the one lined up with the field.
      const field = (await trigger.boundingBox())!;
      const surface = (await list.locator("xpath=..").boundingBox())!;
      expect(surface.y).toBeGreaterThan(field.y + field.height);
      expect(surface.y - (field.y + field.height)).toBeLessThan(12);
      expect(Math.abs(surface.x - field.x)).toBeLessThan(2);
      expect(Math.abs(surface.width - field.width)).toBeLessThan(2);
      // The list covers the line beneath the field rather than sitting under
      // it, as the open live surface does.
      const note = (await page.locator(".fo-selector-note").boundingBox())!;
      const covering = await page.evaluate(
        ([x, y]) =>
          document
            .querySelector('[data-testid="firna-options-list"]')
            ?.parentElement?.contains(document.elementFromPoint(x, y)) === true,
        [note.x + 4, note.y + note.height / 2],
      );
      expect(covering).toBe(true);
    },
  );

  test(
    "a GitHub account's row menu opens where its trigger is: " + label,
    async ({ page }) => {
      await page.setViewportSize(size);
      const name = githubAccounts[0].name;
      // The mobile sheet leaves the layer beneath it hidden from assistive
      // technology, so only there the trigger is found among hidden elements.
      const trigger = page.getByRole("button", {
        name: "Actions for " + name,
        exact: true,
        includeHidden: viewport === "mobile",
      });
      await page.goto(url("product/settings/github"));
      await expect(trigger).toHaveAttribute("aria-expanded", "false");
      await expect(page.getByRole("menu")).toHaveCount(0);
      await page.goto(url("product/settings/github/menu"));
      await expect(trigger).toHaveAttribute("aria-expanded", "true");
      const menu = page.getByRole("menu", { name: "Actions for " + name });
      for (const item of ["Manage on GitHub", "Remove"])
        await expect(
          menu.getByRole("menuitem", { name: item, exact: true }),
        ).toBeVisible();
      const surface = page.getByRole("dialog", { name: "Actions for " + name });
      if (viewport === "desktop") {
        await expect(surface).not.toHaveAttribute("aria-modal", "true");
        const anchor = (await trigger.boundingBox())!;
        const popover = (await surface.locator("xpath=..").boundingBox())!;
        expect(popover.y).toBeGreaterThan(anchor.y + anchor.height);
        expect(
          Math.abs(popover.x + popover.width - (anchor.x + anchor.width)),
        ).toBeLessThan(2);
      } else {
        await expect(surface).toHaveAttribute("aria-modal", "true");
        await expect(surface.getByText(name, { exact: true })).toBeVisible();
        await expect(
          surface.getByRole("button", { name: "Cancel", exact: true }),
        ).toBeVisible();
        const sheet = (await surface.boundingBox())!;
        expect(Math.round(sheet.y + sheet.height)).toBe(size.height);
        expect(Math.round(sheet.width)).toBe(size.width);
      }
      expect(await page.evaluate(settingsDocumentViolations)).toEqual([]);
      await page.goto(url("product/settings/github/remove"));
      await expect(
        page.getByText("Remove " + name + "?", { exact: true }),
      ).toBeVisible();
      await expect(
        page.getByRole("button", { name: "Remove", exact: true }),
      ).toBeEnabled();
      await page.goto(url("product/settings/github/remove/loading"));
      // The working control refuses a second press through its busy state
      // and keeps focus, as Write in progress in `folio-chrome.md` defines.
      await expect(
        page.getByRole("button", { name: "Removing…", exact: true }),
      ).toHaveAttribute("aria-busy", "true");
      expect(await page.evaluate(settingsDocumentViolations)).toEqual([]);
    },
  );
}
