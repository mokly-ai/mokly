import fs from "node:fs/promises";
import path from "node:path";

import { registerFixturePage, type TestFixture } from "./fixture.js";

/** Register one whole-document page with a warning-tier button ancestor. */
export async function registerWarningPage(
  fixture: TestFixture,
  label = "Warning control",
): Promise<string> {
  const sourcePath = path.join(fixture.root, "warning.source.tsx");
  await writeWarningPage(sourcePath, label);
  await registerFixturePage(
    fixture,
    "warning-page",
    "warning.html",
    "warning.source.tsx",
  );
  return sourcePath;
}

/** Retain the warning while changing consumer source for a watched rebuild. */
export async function writeWarningPage(
  sourcePath: string,
  label: string,
): Promise<void> {
  await fs.writeFile(
    sourcePath,
    `import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MockLink } from "@mokly/mokly";
export const source = () => '<!doctype html><html><head><title>Warning</title></head><body>' + renderToStaticMarkup(
  <button><MockLink asChild to="details"><span>{${JSON.stringify(label)}}</span></MockLink></button>
) + '</body></html>';
`,
  );
}
