/**
 * A development build of the standalone shell for mount checks. It bundles
 * the same entry as the delivered `mokly-viewer/client/shell.js` with React's
 * development build, which reports invalid markup and render warnings as
 * console errors that the automatic error fixture fails on.
 */

import path from "node:path";

import { expect, type Page } from "@playwright/test";
import { build } from "esbuild";

import { repositoryRoot } from "../helpers/fixture.js";

/** Bundle the standalone shell entry with React's development build. */
export async function developmentShell(): Promise<string> {
  const result = await build({
    bundle: true,
    define: { "process.env.NODE_ENV": '"development"' },
    entryPoints: [path.join(repositoryRoot, "packages/viewer/src/browser.tsx")],
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

/** Serve `bundle` in place of the delivered shell and count its loads. */
export async function installDevelopmentShell(
  page: Page,
  bundle: string,
): Promise<() => number> {
  let loads = 0;
  await page.route("**/mokly-viewer/client/shell.js", async (route) => {
    loads++;
    await route.fulfill({ body: bundle, contentType: "text/javascript" });
  });
  return () => loads;
}
