import path from "node:path";

import { expect, type Page } from "@playwright/test";
import { build } from "esbuild";

import { timeFixturePhase } from "../helpers/fixture_timing.js";

export async function buildDevelopmentBundle(): Promise<string> {
  const result = await timeFixturePhase(
    "hydration-routes",
    "bundle",
    false,
    () =>
      build({
        bundle: true,
        define: { "process.env.NODE_ENV": '"development"' },
        entryPoints: [path.resolve("packages/viewer/src/browser.tsx")],
        format: "esm",
        logLevel: "silent",
        platform: "browser",
        target: "es2023",
        write: false,
      }),
  );
  const bundle = result.outputFiles[0]?.text ?? "";
  expect(bundle).toContain("react-dom-client.development.js");
  return bundle;
}

export async function installDevelopmentBundle(
  page: Page,
  bundle: string,
): Promise<void> {
  await page.route("**/__mokly/client/react-shell.js", (route) =>
    route.fulfill({ body: bundle, contentType: "text/javascript" }),
  );
}

export async function delayHydration(
  page: Page,
  bundle: string,
): Promise<{ release(): void; requested: Promise<void> }> {
  let markRequested = (): void => undefined;
  const requested = new Promise<void>((resolve) => {
    markRequested = resolve;
  });
  let release = (): void => undefined;
  const released = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/__mokly/client/react-shell.js", async (route) => {
    markRequested();
    await released;
    await route.fulfill({ body: bundle, contentType: "text/javascript" });
  });
  return { release, requested };
}

export function captureBrowserErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() !== "error") return;
    const sandboxDiagnostic =
      message.location().url.includes("/static/") &&
      message.text().startsWith("Blocked script execution in");
    if (!sandboxDiagnostic) errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(error.message));
  return errors;
}

export async function expectCleanHydration(
  page: Page,
  errors: string[],
  context = "hydration",
): Promise<void> {
  await expect(page.locator("html")).toHaveAttribute("data-mokly-hydrated", "");
  await settleBrowser(page);
  expect(errors, context).toEqual([]);
  errors.length = 0;
}

export async function expectNoBrowserErrors(
  page: Page,
  errors: string[],
): Promise<void> {
  await settleBrowser(page);
  expect(errors).toEqual([]);
  errors.length = 0;
}

async function settleBrowser(page: Page): Promise<void> {
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  );
}
