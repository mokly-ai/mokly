import { type Page, expect, test } from "@playwright/test";

import { openSearch } from "./search.js";

type CspWindow = Window & { cspViolations: string[] };

async function watchForViolations(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const target = window as unknown as CspWindow;
    target.cspViolations = [];
    window.addEventListener("securitypolicyviolation", (event) => {
      target.cspViolations.push(
        `${event.effectiveDirective}: ${event.blockedURI}`,
      );
    });
  });
}

async function violations(page: Page): Promise<string[]> {
  return page.evaluate(() => (window as unknown as CspWindow).cspViolations);
}

test(
  "the home page satisfies the production content security policy",
  { tag: "@desktop" },
  async ({ page }) => {
    await watchForViolations(page);
    const response = await page.goto("/");
    expect(response?.headers()["content-security-policy"]).toBeTruthy();
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    expect(await violations(page)).toEqual([]);
  },
);

test(
  "documentation search runs under the production content security policy",
  { tag: "@desktop" },
  async ({ page }) => {
    await watchForViolations(page);
    const response = await page.goto("/docs/cli/serve/");
    expect(response?.headers()["content-security-policy"]).toBeTruthy();
    const dialog = await openSearch(page);
    await dialog.getByRole("searchbox").fill("publish");
    await expect(
      dialog.getByRole("link", { name: "publish", exact: true }),
    ).toBeVisible();
    expect(await violations(page)).toEqual([]);
  },
);
