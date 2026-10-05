import fs from "node:fs/promises";
import path from "node:path";
import type { TestContext } from "node:test";

import { compileCatalogue } from "../../dist/build/compile.js";
import { loadConfig } from "../../dist/config/load.js";

import {
  assertFastPathEquivalent,
  compilationFiles,
} from "./component_fast_path.js";
import { createFixture, removeFixture } from "./fixture.js";

export const membershipSource = `import React from "react";
import { defineComponent, defineScreen } from "@mokly/mokly";
const action = defineComponent({ path: "action", title: "Action", description: "Action", relatedDocs: [],
  propSchema: { kind: "object", properties: {} }, render: () => <button className="action">Continue</button>,
  variants: [{ slug: "default", title: "Default", props: {} }] });
const toolbar = defineComponent({ path: "toolbar", title: "Toolbar", description: "Toolbar", relatedDocs: [],
  propSchema: { kind: "object", properties: {} }, render: () => <div className="toolbar"><action.Component /></div>,
  variants: [{ slug: "default", title: "Default", props: {} }] });
export const mockups = [...action.entries, ...toolbar.entries,
  defineScreen({ path: "checkout", title: "Checkout", description: "Checkout", relatedDocs: [],
    mobile: <main className="checkout"><h1 className="heading">Checkout</h1><toolbar.Component /></main>,
    desktop: <main className="checkout"><h1 className="heading">Checkout</h1><toolbar.Component /></main> })];`;

export async function cssMembershipFixture(
  t: TestContext,
  options: {
    delivery?: "configured" | "declared" | "imported" | "javascript";
    before: string;
    after: string;
    source?: string;
    extraConfig?: string;
    renderer?: string;
    afterSource?: string;
    separateRoots?: boolean;
    screenStylesOnly?: boolean;
  },
) {
  const delivery = options.delivery ?? "configured";
  let source = options.source ?? membershipSource;
  if (delivery === "declared" || delivery === "imported") {
    if (options.screenStylesOnly)
      source = source
        .replace(
          "export const mockups",
          `const skin = defineComponent({path:"skin",title:"Skin",description:"Skin",relatedDocs:[],stylesheets:["entry.css"],propSchema:{kind:"object",properties:{}},render:()=>null,variants:[{slug:"default",title:"Default",props:{}}]});\nexport const mockups`,
        )
        .replace(
          "[...action.entries, ...toolbar.entries,",
          "[...action.entries, ...toolbar.entries, ...skin.entries,",
        )
        .replaceAll(
          '<main className="checkout">',
          '<main className="checkout"><skin.Component />',
        );
    else
      source = source.replace(
        'path: "action",',
        'path: "action", stylesheets: ["entry.css"],',
      );
  }
  if (delivery === "javascript") source = 'import "./rule.css";\n' + source;
  const fixture = await createFixture(source, {
    extraConfig:
      (options.extraConfig ?? "") +
      (options.renderer ? 'renderer: "renderer.tsx",' : "") +
      (delivery === "configured"
        ? `stylesheets: [{ match: "${options.screenStylesOnly ? "checkout/**" : "**"}", stylesheets: ["rule.css"] }],`
        : "stylesheets: [],"),
  });
  t.after(() => removeFixture(fixture));
  if (options.separateRoots) {
    const boundary = source.indexOf("export const mockups");
    let shared = source
      .slice(0, boundary)
      .replace("const action =", "export const action =")
      .replace("const toolbar =", "export const toolbar =");
    if (options.screenStylesOnly)
      shared = shared.replace('import "./rule.css";\n', "");
    await fs.writeFile(path.join(fixture.entriesDir, "shared.tsx"), shared);
    await fs.writeFile(
      path.join(fixture.entriesDir, "components.mockup.tsx"),
      'import { action, toolbar } from "./shared.js"; export const mockups = [...action.entries, ...toolbar.entries];',
    );
    await fs.writeFile(
      fixture.entryPath,
      (options.screenStylesOnly ? 'import "./rule.css";\n' : "") +
        'import React from "react"; import {defineScreen} from "@mokly/mokly"; import { toolbar } from "./shared.js";\n' +
        source
          .slice(boundary)
          .replace("[...action.entries, ...toolbar.entries,", "["),
    );
  }
  if (options.renderer)
    await fs.writeFile(
      path.join(fixture.root, "renderer.tsx"),
      options.renderer,
    );
  const rulePath =
    delivery === "javascript"
      ? path.join(path.dirname(fixture.entryPath), "rule.css")
      : path.join(
          fixture.mockupsDir,
          delivery === "declared" ? "entry.css" : "rule.css",
        );
  await fs.writeFile(rulePath, options.before);
  if (delivery === "imported")
    await fs.writeFile(
      path.join(fixture.mockupsDir, "entry.css"),
      '@import "./rule.css";',
    );
  const config = await loadConfig(fixture.root);
  const before = await compileCatalogue(config);
  await fs.writeFile(rulePath, options.after);
  if (options.afterSource)
    await fs.writeFile(fixture.entryPath, options.afterSource);
  const after = await compileCatalogue(config);
  const resources = (css: string) =>
    delivery === "javascript"
      ? {}
      : {
          [delivery === "declared" ? "entry.css" : "rule.css"]: css,
          ...(delivery === "imported"
            ? { "entry.css": '@import "./rule.css";' }
            : {}),
        };
  const input = {
    before: before.manifest,
    after: after.manifest,
    beforeFiles: compilationFiles(before, resources(options.before)),
    afterFiles: compilationFiles(after, resources(options.after)),
    config,
    changedPaths:
      delivery === "javascript"
        ? [...after.outputs.keys()]
            .filter((route) => route.endsWith(".css"))
            .map((route) => `mockups/${route}`)
        : [`mockups/${path.basename(rulePath)}`],
  };
  const result = await assertFastPathEquivalent(input);
  return { fixture, config, before, after, input, result };
}

export function changedEntries(
  result: Awaited<ReturnType<typeof cssMembershipFixture>>["result"],
) {
  return result.changes
    .map((entry) => (entry.after ?? entry.before)!.path)
    .sort();
}
