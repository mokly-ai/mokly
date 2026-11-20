import { expect, open, test } from "./harness";

for (const scheme of ["light", "dark"] as const)
  test(
    "live Firna controls retain the keyboard focus glow: " + scheme,
    async ({ page }) => {
      await page.emulateMedia({ colorScheme: scheme });
      await open(page, "/sign-in");
      await expect(page.locator("html")).toHaveAttribute(
        "data-color-scheme",
        scheme,
      );
      await expect(page.locator("head #firna-ui-dom-backend")).toHaveCount(1);

      await page.keyboard.press("Tab");
      const input = page.getByRole("textbox", { name: "Email", exact: true });
      await input.focus();
      await expect(input).toBeFocused();
      const frame = input.locator("..");
      await expect(frame).toHaveAttribute(
        "data-firna-focus-ring",
        "descendant",
      );
      await expect(frame).toHaveCSS("box-shadow", /4px/);

      await input.fill("focus@example.com");
      const action = page.getByRole("button", {
        name: "Continue with email",
        exact: true,
      });
      await expect(action).toBeEnabled();
      await action.focus();
      await expect(action).toBeFocused();
      await expect(action).toHaveAttribute("data-firna-focus-ring", "self");
      await expect(action).toHaveCSS("box-shadow", /4px/);
    },
  );
