import path from "node:path";

import { expect, type Page, type Route } from "@playwright/test";
import { build } from "esbuild";

let hostBundle: Promise<string> | undefined;

export async function buildDevelopmentBundle(): Promise<string> {
  const result = await build({
    bundle: true,
    define: { "process.env.NODE_ENV": '"development"' },
    entryPoints: [path.resolve("packages/viewer/src/browser.tsx")],
    format: "esm",
    logLevel: "silent",
    platform: "browser",
    target: "es2023",
    write: false,
  });
  const bundle = result.outputFiles[0]?.text ?? "";
  expect(bundle).toContain("react-dom-client.development.js");
  return bundle;
}

export async function installDevelopmentBundle(
  page: Page,
  bundle: string,
): Promise<void> {
  const host = await buildDevelopmentHostBundle();
  await page.route("**/__mokly/client/react-shell.js", (route) =>
    route.fulfill({ body: bundle, contentType: "text/javascript" }),
  );
  await page.route("**/__mokly/client/react-host.js", (route) =>
    route.fulfill({ body: host, contentType: "text/javascript" }),
  );
}

export async function delayHydration(
  page: Page,
  bundle: string,
): Promise<{ release(): void; requested: Promise<void> }> {
  const host = await buildDevelopmentHostBundle();
  let markRequested = (): void => undefined;
  const requested = new Promise<void>((resolve) => {
    markRequested = resolve;
  });
  let release = (): void => undefined;
  const released = new Promise<void>((resolve) => {
    release = resolve;
  });
  const delay = (body: string) => async (route: Route) => {
    markRequested();
    await released;
    await route.fulfill({ body, contentType: "text/javascript" });
  };
  await page.route("**/__mokly/client/react-shell.js", delay(bundle));
  await page.route("**/__mokly/client/react-host.js", delay(host));
  return { release, requested };
}

async function buildDevelopmentHostBundle(): Promise<string> {
  hostBundle ??= build({
    bundle: true,
    define: { "process.env.NODE_ENV": '"development"' },
    entryPoints: [path.resolve("src/client/react_host.ts")],
    format: "esm",
    logLevel: "silent",
    platform: "browser",
    target: "es2023",
    write: false,
  }).then((result) => {
    const bundle = result.outputFiles[0]?.text ?? "";
    expect(bundle).toContain("react-dom-client.development.js");
    return bundle;
  });
  return hostBundle;
}

export function captureBrowserErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() !== "error") return;
    const sandboxDiagnostic =
      message.text().startsWith("Blocked script execution in") &&
      (message.location().url.includes("/static/") ||
        /^Blocked script execution in 'https?:\/\/[^/]+\/static\//u.test(
          message.text(),
        ));
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
