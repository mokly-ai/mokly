import fs from "node:fs/promises";

import type { Page } from "@playwright/test";
import { createElement, Fragment, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

/**
 * Renders the elements on a page whose only styles are the built standalone
 * shell stylesheet, which bundles the `@mokly/ui` rules and declares the
 * palette.
 */
export async function renderWithShellStyles(
  page: Page,
  elements: readonly ReactElement[],
): Promise<void> {
  const css = await fs.readFile(
    new URL("../../packages/viewer/dist/shell.css", import.meta.url),
    "utf8",
  );
  const markup = renderToStaticMarkup(
    createElement(Fragment, null, ...elements),
  );
  await page.setContent(
    `<html><head><style>${css}</style></head><body>${markup}</body></html>`,
  );
}
