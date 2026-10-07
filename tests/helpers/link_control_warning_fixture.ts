import { execFileSync } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";

import type { BuildDiagnostic } from "../../dist/build/build_warnings.js";

import {
  createFixture,
  registerFixturePage,
  type TestFixture,
} from "./fixture.js";

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

/** Warn before a later resource failure in the real pipeline. */
export async function linkWarningFailureFixture(
  outcome: "resource" | "success",
) {
  const fixture = await createFixture(
    `import {defineScreen,MockLink} from '@mokly/mokly';
const body=<main><button><MockLink asChild to='target'><span>Next</span></MockLink></button><img src='../../image.png'/></main>;
export default [defineScreen({path:'home',title:'Home',description:'Home',relatedDocs:[],dependencies:[],mobile:body,desktop:body}),
defineScreen({path:'target',title:'Target',description:'Target',relatedDocs:[],mobile:<main>Target</main>,desktop:<main>Target</main>})];`,
  );
  execFileSync("git", ["init", "-q"], { cwd: fixture.root });
  if (outcome !== "resource")
    await fs.writeFile(
      path.join(fixture.mockupsDir, "image.png"),
      Buffer.from([1, 2, 3]),
    );
  const diagnostics: BuildDiagnostic[] = [
    {
      code: "removed-dependencies",
      subject: { kind: "entry", path: "home" },
      message: "dependencies has been removed; ignoring it. Delete the field.",
    },
    ...["desktop", "mobile"].map((viewport) => ({
      code: "link-control-ancestor" as const,
      route: `home/index.${viewport}.html`,
      message:
        "MockLink child control is inside <button>; one click or key press has two targets",
    })),
  ];
  return {
    ...fixture,
    diagnostics,
    failure:
      outcome === "resource"
        ? /missing target .*image\.png/
        : /unexpected successful fixture failure/,
  };
}
