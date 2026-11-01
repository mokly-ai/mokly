import { type Page } from "@playwright/test";

export const control = ".mbk-topbar [data-mokly-appearance-control]";

export const select = "[data-mokly-appearance-select]";

export const mobileFrame = ".mbk-frame-mobile iframe";

export const desktopFrame = ".mbk-frame-desktop iframe";

export const screen = "/view/example/screens/welcome/";

/**
 * The appearance the document actually settled on: the document root's mark,
 * the shell root's preview scheme, and the control's value.
 */
export async function appearance(page: Page): Promise<{
  scheme: string | null;
  theme: string | null;
  value: string;
}> {
  return await page.evaluate(() => ({
    scheme:
      document
        .querySelector(".mbk[data-mokly-shell]")
        ?.getAttribute("data-mokly-color-scheme") ?? null,
    theme: document.documentElement.getAttribute("data-mokly-theme"),
    value:
      document.querySelector<HTMLSelectElement>(
        "[data-mokly-appearance-select]",
      )?.value ?? "",
  }));
}

export async function store(page: Page, value: string): Promise<void> {
  await page.addInitScript((theme) => {
    localStorage.setItem("mokly:theme", theme as string);
  }, value);
}
