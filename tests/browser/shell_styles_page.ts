import fs from "node:fs/promises";
import { fileURLToPath } from "node:url";

import type { Page } from "@playwright/test";
import { build } from "esbuild";

/**
 * Runs a browser entry, which draws `@mokly/ui` components into the body and
 * then marks the body `data-rendered`, on a page whose only styles are the
 * built standalone shell stylesheet, which bundles the package rules and
 * declares the palette on the stub document class that the page carries.
 * The entry renders in the page, not in the test process: under Node 22, a
 * package component that renders in a Playwright worker fails once another
 * spec of the worker has loaded `@mokly/viewer`.
 */
export async function renderWithShellStyles(
  page: Page,
  entry: URL,
): Promise<void> {
  const [css, bundle] = await Promise.all([
    fs.readFile(
      new URL("../../packages/viewer/dist/shell.css", import.meta.url),
      "utf8",
    ),
    build({
      entryPoints: [fileURLToPath(entry)],
      bundle: true,
      write: false,
      format: "iife",
      platform: "browser",
      target: "es2023",
      logLevel: "silent",
    }),
  ]);
  await page.setContent(
    `<html class="mbk-document"><head><style>${css}</style></head><body></body></html>`,
  );
  await page.addScriptTag({ content: bundle.outputFiles[0]!.text });
  await page.locator("body[data-rendered]").waitFor({ state: "attached" });
}
