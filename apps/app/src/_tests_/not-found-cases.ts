import { expect } from "@playwright/test";
import type { Page, Request } from "@playwright/test";

export const notFoundPaths = ["/this/route/has/no/match", "/_sitemap"] as const;

/** Assert one unmatched app address uses Mokly's local recovery only. */
export async function expectNotFoundRecovery(
  page: Page,
  pathname: string,
  largeText = false,
): Promise<void> {
  const productReads: string[] = [];
  const remember = (request: Request) => {
    const path = new URL(request.url()).pathname;
    if (
      path.startsWith("/v1/workspaces") ||
      path.startsWith("/v1/projects") ||
      path.startsWith("/v1/publications")
    ) {
      productReads.push(path);
    }
  };
  page.on("request", remember);

  await page.goto(pathname);
  if (largeText) await page.addStyleTag({ content: "html{font-size:32px}" });
  const recovery = page.locator('[data-mkc-screen="recovery-not-found"]');
  await expect(recovery).toBeVisible();
  await expect(recovery.locator(".fo-recovery-body")).toBeVisible();
  await expect(
    recovery.getByRole("heading", { level: 1, name: "Page not found" }),
  ).toHaveCount(1);
  const action = recovery.getByRole("button", { name: "Open dashboard" });
  await expect(action).toHaveCount(1);
  await expect(recovery.getByRole("button")).toHaveCount(1);
  await expect(recovery.getByRole("link", { name: "Sitemap" })).toHaveCount(0);
  await expect(recovery.getByText("Unmatched Route")).toHaveCount(0);
  await expect(recovery.getByText(pathname, { exact: true })).toHaveCount(0);
  expect(new URL(page.url()).pathname).toBe(pathname);
  const overflow = await recovery.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(overflow).toBeLessThanOrEqual(1);
  page.off("request", remember);
  expect(productReads).toEqual([]);

  await action.click();
  await expect(page).toHaveURL(
    (url) =>
      url.pathname === "/sign-in" &&
      url.searchParams.get("returnTo") === "/dashboard",
  );
}
