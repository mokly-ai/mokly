import { execFileSync } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";

import type { BuildDiagnostic } from "../../dist/build/build_warnings.js";
import { compileCatalogue } from "../../dist/build/compile.js";
import { writeCompilation } from "../../dist/build/transaction.js";
import { loadConfig } from "../../dist/config/load.js";

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
  outcome: "resource" | "success" | "placement" | "placement-success",
) {
  if (outcome.startsWith("placement"))
    return stylesheetPlacementFixture(outcome === "placement-success");
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

/** Keep missing anchors while changing only the renderer's style range. */
async function stylesheetPlacementFixture(success: boolean) {
  const fixture = await createFixture(
    `import {defineComponent,defineScreen} from '@mokly/mokly';
const action=defineComponent({path:'action',title:'Action',description:'Action',relatedDocs:[],stylesheets:['action.css'],propSchema:{kind:'object',properties:{}},render:()=> <button>Continue</button>,variants:[{slug:'default',title:'Default',props:{}}]});
const body=<main><action.Component /></main>;
export default [...action.entries,defineScreen({path:'home',title:'Home',description:'Home',relatedDocs:[],mobile:body,desktop:body})];`,
    {
      extraConfig:
        'renderer: "renderer.tsx", stylesheets: [{match: "**", stylesheets: ["base.css"]}],',
    },
  );
  await fs.writeFile(
    path.join(fixture.root, "renderer.tsx"),
    `import {renderToStaticMarkup} from 'react-dom/server';
export default input => ({html:'<!doctype html><html><head></head><body>'+renderToStaticMarkup(input.node)+'</body></html>'});`,
  );
  for (const file of ["action.css", "base.css"])
    await fs.writeFile(path.join(fixture.mockupsDir, file), "body{margin:0}");
  await fs.writeFile(
    path.join(fixture.root, ".gitignore"),
    "mockups/mokly-generated/\n.mokly-cache/\n.mokly-export-reservations/\nsite/\n",
  );
  const git = (...args: string[]) =>
    execFileSync("git", args, { cwd: fixture.root });
  git("init", "-q");
  git("config", "user.email", "test@example.invalid");
  git("config", "user.name", "Test");
  const config = await loadConfig(fixture.root);
  await writeCompilation(await compileCatalogue(config), config);
  git("add", ".");
  git("add", "-f", "mockups/mokly-generated");
  git("commit", "-qm", "test: placement warning baseline");
  git("update-ref", "refs/remotes/origin/main", "HEAD");
  if (!success) {
    const renderer = path.join(fixture.root, "renderer.tsx");
    await fs.writeFile(
      renderer,
      (await fs.readFile(renderer, "utf8")).replace(
        "({html:",
        '({styles:[{startOffset:0,endOffset:1,componentIds:["action"]}],html:',
      ),
    );
    git("add", "renderer.tsx");
    git("commit", "-qm", "test: invalid placement style range");
  }
  const diagnostics: BuildDiagnostic[] = (
    success
      ? [
          ["action/default/index.desktop.html", "../../../base.css"],
          ["action/default/index.mobile.html", "../../../base.css"],
          ["home/index.desktop.html", "../../base.css"],
          ["home/index.mobile.html", "../../base.css"],
        ]
      : [["action/default/index.mobile.html", "../../../base.css"]]
  ).map(([route, href]) => ({
    code: "missing-configured-stylesheet-link",
    route: route!,
    message: `configured stylesheet link "${href}" is absent; component stylesheets use another anchor.`,
  }));
  return {
    ...fixture,
    diagnostics,
    failure: /ownership must name preserved text inside a style element/,
  };
}
