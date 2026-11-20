import { pathToFileURL } from "node:url";

import { tokens } from "@mokly-cloud/tokens/tokens";
import { expect, test } from "@playwright/test";

import { componentFile, screenFile } from "./catalogue-paths";
import { rgb } from "./color-metrics";
import {
  controlDocumentViolations,
  controlPolicyInput,
} from "./controls-document-policy";

/** The file URL of one saved variant of a registered design component. */
function variantUrl(
  component: string,
  variant: string,
  viewport: "mobile" | "desktop" = "desktop",
  scheme: "light" | "dark" = "light",
): string {
  return pathToFileURL(
    componentFile("design/" + component + "/" + variant, viewport, scheme),
  ).href;
}

/** The quiet tone is the library's ghost: accent ink on no fill and no edge. */
const transparent = "rgba(0, 0, 0, 0)";

test("disabled input is inert and skipped by keyboard navigation", async ({
  page,
}) => {
  await page.goto(variantUrl("input", "disabled"));
  const input = page.getByRole("textbox", { name: "Email" });
  await expect(input).toBeDisabled();
  await page.keyboard.press("Tab");
  await expect(input).not.toBeFocused();
});

for (const viewport of ["mobile", "desktop"] as const) {
  for (const scheme of ["light", "dark"] as const) {
    const c = tokens.color[scheme];
    const url = (component: string, variant: string) =>
      variantUrl(component, variant, viewport, scheme);

    test(
      "shared buttons and fields: " + viewport + " " + scheme,
      async ({ page }) => {
        await page.setViewportSize({
          width: viewport === "mobile" ? 390 : 1440,
          height: 900,
        });
        for (const tone of ["primary", "secondary", "quiet"]) {
          await page.goto(url("button", tone));
          const button = page.getByRole("button");
          await expect(button).toBeEnabled();
          await page.keyboard.press("Tab");
          await expect(button).toBeFocused();
          await expect(button).not.toHaveCSS("outline-style", "none");
          expect((await button.boundingBox())?.height).toBeGreaterThanOrEqual(
            44,
          );
          await expect(button).toHaveCSS("border-radius", tokens.radius.medium);
          await expect(button.locator("[dir]").first()).toHaveCSS(
            "color",
            rgb(tone === "primary" ? c.onAccent : c.paperInk),
          );
          await expect(button).toHaveCSS(
            "background-color",
            tone === "quiet"
              ? transparent
              : rgb(tone === "primary" ? c.accentSolid : c.paperSurface),
          );
          await expect(button).toHaveCSS(
            "border-top-color",
            tone === "quiet"
              ? transparent
              : rgb(tone === "primary" ? c.accentSolid : c.paperLineStrong),
          );
        }
        await page.goto(url("button", "disabled"));
        await expect(page.getByRole("button")).toBeDisabled();
        await page.keyboard.press("Tab");
        await expect(page.getByRole("button")).not.toBeFocused();
        for (const state of ["empty", "filled", "invalid", "disabled"]) {
          await page.goto(url("input", state));
          const input = page.getByRole("textbox", { name: "Email" });
          await expect(input).toHaveAttribute("type", "email");
          await expect(input).toHaveAttribute("autocomplete", "email");
          await expect(input).toHaveCSS("color", rgb(c.paperInk));
          await expect(input.locator("..")).toHaveCSS(
            "background-color",
            rgb(c.paperSurface),
          );
          await expect(input.locator("..")).toHaveCSS(
            "border-top-color",
            rgb(state === "invalid" ? c.danger : c.paperLineStrong),
          );
          if (state === "disabled") {
            await expect(input).toBeDisabled();
            await page.keyboard.press("Tab");
            await expect(input).not.toBeFocused();
          } else {
            await page.keyboard.press("Tab");
            await expect(input).toBeFocused();
            const focusHost = input.locator("..");
            await expect(focusHost).toHaveAttribute(
              "data-firna-focus-host",
              "descendant",
            );
            await expect(focusHost).not.toHaveCSS("outline-style", "none");
            if (state === "invalid")
              await expect(input).toHaveAccessibleDescription(
                "Enter a complete email address.",
              );
            await input.fill("reviewer@example.com");
            await expect(input).toHaveValue("reviewer@example.com");
          }
        }
      },
    );

    test(
      "shared statuses and avatars: " + viewport + " " + scheme,
      async ({ page }) => {
        for (const [tone, ink, fill, label] of [
          ["neutral", c.paperInk, c.paperMuted, "Open"],
          ["success", c.accent, c.accentSoft, "Approved"],
          ["warning", c.warning, c.warningSoft, "Needs review"],
          ["danger", c.danger, c.dangerSoft, "Unable to publish"],
        ]) {
          await page.goto(url("badge", tone));
          const badge = page.getByTestId("firna-badge-" + tone);
          await expect(badge).toHaveText(label);
          await expect(badge).toHaveCSS("background-color", rgb(fill));
          await expect(badge.locator("[dir]").first()).toHaveCSS(
            "color",
            rgb(ink),
          );
          await page.goto(url("status-dot", tone));
          await expect(page.getByRole("img", { name: label })).toBeVisible();
        }
        for (const variant of ["soft", "solid"]) {
          await page.goto(url("avatar", variant));
          await expect(page.getByRole("img")).toHaveAccessibleName(
            variant === "soft" ? "AL" : "JD",
          );
        }
        await page.goto(url("comment-thread", "resolved"));
        await expect(page.getByTestId("firna-avatar")).toHaveAttribute(
          "aria-hidden",
          "true",
        );
        await expect(page.getByTestId("firna-status-dot")).toHaveCount(0);
        await expect(
          page
            .getByTestId("firna-badge-success")
            .locator('[aria-hidden="true"]'),
        ).toHaveCount(1);
        await expect(page.getByTestId("firna-badge-success")).toHaveText(
          "Resolved",
        );
      },
    );
  }
}

/**
 * Damage to an input page's head, each as a build could cause it: React Native
 * Web's rules left out, Firna's stylesheet left out, or React Native Web's
 * rules after the configured stylesheets, where Mokly 0.14.0 put them. Each
 * runs in the page with Firna's stylesheet text.
 */
const headDamage = [
  [
    (css: string) => {
      const style = [...document.head.querySelectorAll("style")].find((node) =>
        node.textContent?.includes(css),
      )!;
      style.textContent = style.textContent!.slice(
        style.textContent!.indexOf(css),
      );
    },
    "atomic stylesheet required",
  ],
  [
    (css: string) => {
      for (const style of document.head.querySelectorAll("style"))
        style.textContent = style.textContent!.replace(css, "");
    },
    "Firna stylesheet required",
  ],
  [
    (css: string) => {
      const style = [...document.head.querySelectorAll("style")].find((node) =>
        node.textContent?.includes(css),
      )!;
      document.head.append(style);
    },
    "atomic styles must precede the configured stylesheets",
  ],
] as const;

test("rendered controls reject absent styles, disabled actions and broken field associations", async ({
  page,
}) => {
  const input = controlPolicyInput(false);
  const inputUrl = variantUrl("input", "invalid");
  for (const [damage, problem] of headDamage) {
    await page.goto(inputUrl);
    expect(await page.evaluate(controlDocumentViolations, input)).toEqual([]);
    await page.evaluate(damage, input.firnaCss);
    expect(await page.evaluate(controlDocumentViolations, input)).toContain(
      problem,
    );
  }
  for (const selector of ['[id$="-label"]', '[id$="-error"]']) {
    await page.goto(inputUrl);
    await page.locator(selector).evaluate((node) => node.remove());
    expect(
      (await page.evaluate(controlDocumentViolations, input)).length,
    ).toBeGreaterThan(0);
  }
  await page.goto(variantUrl("button", "primary"));
  await page
    .getByRole("button")
    .evaluate((node) => node.setAttribute("aria-disabled", "true"));
  expect(await page.evaluate(controlDocumentViolations, input)).toContain(
    "enabled action rendered disabled",
  );
  const menuUrl = variantUrl("responsive-menu", "closed");
  for (const [attribute, problem] of [
    ["aria-label", "icon-only trigger needs a name"],
    ["aria-haspopup", "menu trigger must announce its popup"],
    ["aria-expanded", "menu trigger must announce whether it is open"],
  ] as const) {
    await page.goto(menuUrl);
    expect(await page.evaluate(controlDocumentViolations, input)).toEqual([]);
    await page
      .getByTestId("firna-responsive-menu-trigger")
      .evaluate((node, name) => node.removeAttribute(name), attribute);
    expect(await page.evaluate(controlDocumentViolations, input)).toContain(
      problem,
    );
  }
});

test("adapted Firna calls to action support keyboard navigation from disk", async ({
  page,
}) => {
  await page.goto(
    pathToFileURL(screenFile("product/settings/sections/empty", "desktop"))
      .href,
  );
  const action = page
    .locator("main")
    .getByRole("link", { name: "Create workspace", exact: true })
    .first();
  await action.focus();
  await expect(action).not.toHaveCSS("outline-style", "none");
  await action.press("Enter");
  await expect(page).toHaveURL(
    pathToFileURL(screenFile("product/account/create-workspace", "desktop"))
      .href,
  );
});

test("mobile threads fill their container", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  for (const state of ["open", "resolved"])
    for (const scheme of ["light", "dark"] as const) {
      await page.goto(variantUrl("comment-thread", state, "mobile", scheme));
      const card = await page.locator(".comment-thread").boundingBox();
      const container = await page.locator(".component-example").boundingBox();
      expect(card?.width).toBeGreaterThanOrEqual((container?.width ?? 0) - 1);
    }
});

test("thread status is one dotted pill", async ({ page }) => {
  await page.goto(variantUrl("comment-thread", "open", "mobile"));
  const thread = page.locator(".comment-thread");
  await expect(thread.getByTestId("firna-status-dot")).toHaveCount(0);
  const pill = thread.getByTestId("firna-badge-neutral");
  await expect(pill).toHaveText("Open");
  await expect(pill.locator('[aria-hidden="true"]')).toHaveCount(1);
});
