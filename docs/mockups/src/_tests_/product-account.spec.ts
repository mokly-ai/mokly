import { tokens } from "@mokly-cloud/tokens/tokens";
import { expect, test } from "@playwright/test";

import { notices, onboarding } from "../fixtures/product-states";
import { site } from "../fixtures/site";

import { rgb } from "./color-metrics";
import { productRun, productSchemes, productViewports } from "./product-runs";

/**
 * The account family's shared panel and header, and what its entry screens
 * offer: links to the public site and a notice for a GitHub way in that is
 * not open.
 */

/** Every account screen, the identity its header names and the step it reports. */
const accountFrame = [
  ["sign-up", "none", 0],
  ["sign-in", "none", 0],
  ["magic-link", "link", 0],
  ["sign-in/desktop", "none", 0],
  ["connect-desktop", "signed-in", 0],
  ["callback/desktop-expired", "none", 0],
  ["create-workspace", "signed-in", 1],
  ["install-app", "signed-in", 2],
  ["install-app/member", "signed-in", 2],
  ["install-app/reviewer", "signed-in", 2],
  ["install-app/connect", "signed-in", 2],
  ["choose-repository", "signed-in", 3],
  ["choose-repository/cli", "signed-in", 3],
  ["callback/install-requested", "signed-in", 0],
  ["callback/install-conflict", "signed-in", 0],
  ["callback/install-denied", "signed-in", 0],
  ["project-created", "signed-in", 0],
] as const;

/** The three setup steps, in the order the progress strip reports them. */
const stepLabels = ["Workspace", "Install", "Repository"] as const;

/** Elements painted with the one solid accent a screen is allowed to spend. */
function accentFills(fill: string) {
  return [...document.querySelectorAll("*")].filter(
    (node) => getComputedStyle(node).backgroundColor === fill,
  ).length;
}

for (const viewport of productViewports)
  for (const scheme of productSchemes) {
    const { url, label, size } = productRun(viewport, scheme);

    test(
      "account entry leaves for the public site: " + label,
      async ({ page }) => {
        await page.setViewportSize(size);
        await page.goto(url("product/account/sign-up"));
        await expect(
          page.getByRole("link", { name: "Mokly home" }),
        ).toHaveAttribute("href", site.home);
        for (const [name, href] of [
          ["Terms", site.terms],
          ["Privacy", site.privacy],
        ] as const)
          await expect(
            page.getByRole("link", { name, exact: true }).first(),
          ).toHaveAttribute("href", href);
        await page
          .locator(".fo-account-switch")
          .getByRole("link", { name: "Sign in" })
          .click();
        await expect(page.locator("[data-mkc-screen]")).toHaveAttribute(
          "data-mkc-screen",
          "product/account/sign-in",
        );
        await page.goto(url("product/account/sign-up/empty"));
        await expect(
          page.getByRole("textbox", { name: "Email", exact: true }),
        ).toHaveValue("");
        await expect(
          page.getByRole("button", { name: "Continue with email" }),
        ).toBeDisabled();
      },
    );

    test(
      "the entry screens answer a GitHub way in that is not open: " + label,
      async ({ page }) => {
        await page.setViewportSize(size);
        for (const screen of ["sign-in", "sign-up"]) {
          await page.goto(
            url("product/account/" + screen + "/github-opens-soon"),
          );
          // Nothing failed, so nothing is announced as an alert and there is
          // no reference to disclose; the notice is polite and stands where
          // that control's causes stand.
          await expect(page.getByRole("status"), screen).toHaveText(
            notices.githubOpensSoon,
          );
          await expect(page.locator(".fo-write-failure"), screen).toHaveCount(
            0,
          );
          await expect(page.locator(".fo-error-details"), screen).toHaveCount(
            0,
          );
          expect(
            await page.evaluate(() => {
              const notice = document.querySelector('[role="status"]');
              const control = document.querySelector(
                '[data-testid="firna-button-secondary"]',
              );
              return (
                notice !== null &&
                control !== null &&
                (notice.compareDocumentPosition(control) &
                  Node.DOCUMENT_POSITION_FOLLOWING) !==
                  0
              );
            }),
            screen + ": the notice is above Continue with GitHub",
          ).toBe(true);
          // Both controls are at rest: there is nothing to send again. The
          // GitHub control is found by its test id because a control that
          // navigates is an anchor, exactly as the fragment's own read does.
          await expect(
            page.locator('[data-testid="firna-button-secondary"]'),
            screen,
          ).toHaveText("Continue with GitHub");
          // A drawing never offers what its own copy refuses: the control this
          // notice is about opens nothing while it says it is not open yet.
          await expect(
            page.locator('[data-testid="firna-button-secondary"]'),
            screen + ": the closed way in opens nothing",
          ).not.toHaveAttribute("data-mokly-link", /.*/);
          await expect(
            page.getByRole("button", {
              name: "Continue with email",
              exact: true,
            }),
            screen,
          ).toBeVisible();
          await expect(
            page.getByRole("textbox", { name: "Email", exact: true }),
            screen,
          ).not.toHaveAttribute("aria-invalid", "true");
        }
      },
    );

    test(
      "the account family shares one panel and one header: " + label,
      async ({ page }) => {
        await page.setViewportSize(size);
        const fill = rgb(tokens.color[scheme].accentSolid);
        const heights = new Set<number>();
        for (const [screen, identity, step] of accountFrame) {
          await page.goto(url("product/account/" + screen));
          const panel = page.locator(".fo-account-panel");
          const header = page.locator(".fo-account-header");
          await expect(panel).toBeVisible();
          expect((await panel.boundingBox())!.width).toBe(
            viewport === "desktop" ? 440 : 350,
          );
          await expect(panel.locator(".review-brand")).toHaveCount(1);
          await expect(header.locator(".review-brand")).toHaveCount(0);
          await expect(header.locator(":scope > *")).toHaveCount(
            identity === "none" ? 0 : 1,
          );
          const named = header.locator(".review-account");
          await expect(named).toHaveCount(identity === "signed-in" ? 1 : 0);
          if (identity === "signed-in") {
            // The fixture reader has set a display name, so the name is the
            // label and the email is the tooltip behind it.
            await expect(named, screen).toContainText("Cal");
            await expect(named, screen).toHaveAttribute(
              "title",
              onboarding.email,
            );
          }
          expect((await header.boundingBox())!.height).toBe(48);
          heights.add((await header.boundingBox())!.height);
          const progress = panel.locator(".fo-account-progress");
          await expect(progress).toHaveCount(step ? 1 : 0);
          if (step) {
            const strip = progress.locator(".fo-steps");
            const count = progress.locator(".fo-step-count");
            await expect(count.locator(".fo-step-count-label")).toHaveText(
              stepLabels[step - 1] +
                "Step " +
                step +
                " of " +
                stepLabels.length,
            );
            await expect(
              count.locator(".fo-step-track > [aria-current=step]"),
            ).toHaveCount(1);
            await expect(
              count.locator(".fo-step-track > [data-complete]"),
            ).toHaveCount(step - 1);
            if (viewport === "desktop") {
              await expect(strip).toBeVisible();
              await expect(count).toBeHidden();
              await expect(strip.locator("[aria-current=step]")).toHaveText(
                String(step) + stepLabels[step - 1],
              );
            } else {
              await expect(strip).toBeHidden();
              await expect(count).toBeVisible();
            }
          }
          const primaries = await page
            .getByTestId("firna-button-primary")
            .count();
          expect(primaries).toBeLessThanOrEqual(1);
          expect(await page.evaluate(accentFills, fill)).toBe(primaries);
        }
        expect(heights.size).toBe(1);
      },
    );
  }
