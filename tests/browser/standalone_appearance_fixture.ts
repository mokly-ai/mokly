import { type Page } from "@playwright/test";

import { exportCatalogue } from "../../dist/export/run.js";
import { createExportFixture } from "../helpers/export_fixture.js";
import { serveStaticFiles } from "../helpers/static_server.js";

import { buildDevelopmentBundle } from "./react_shell_hydration_helpers.js";

export const suiteState = {
  lightOnlyFixture: undefined! as Awaited<
    ReturnType<typeof createExportFixture>
  >,
  lightOnlySite: undefined! as Awaited<ReturnType<typeof serveStaticFiles>>,
  developmentBundle: undefined! as string,
};

export const control = ".mbk-topbar [data-mokly-appearance-control]";

export const select = "[data-mokly-appearance-select]";

export const mobileFrame = ".mbk-frame-mobile iframe";

export const desktopFrame = ".mbk-frame-desktop iframe";

export const screen = "/view/screens/example-welcome.html";

export /** The appearance the document actually settled on, root mark and all. */
async function appearance(page: Page): Promise<{
  scheme: string | null;
  theme: string | null;
  value: string;
}> {
  return await page.evaluate(() => ({
    scheme: document.body.getAttribute("data-mokly-color-scheme"),
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

export const startSuite = async () => {
  suiteState.developmentBundle = await buildDevelopmentBundle();
  suiteState.lightOnlyFixture = await createExportFixture();
  await exportCatalogue(suiteState.lightOnlyFixture.config, { outDir: "site" });
  suiteState.lightOnlySite = await serveStaticFiles(
    suiteState.lightOnlyFixture.output,
  );
};

export const stopSuite = async () => {
  await suiteState.lightOnlySite.close();
  await suiteState.lightOnlyFixture.close();
};
