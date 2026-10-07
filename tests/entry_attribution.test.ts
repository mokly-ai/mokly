import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import { compileCatalogue } from "../dist/build/compile.js";
import { loadConfig } from "../dist/config/load.js";
import { resolveExportOutput } from "../dist/export/paths.js";
import { receiveComponentRuntimeStartup } from "../dist/server/controls/runtime_ipc.js";
import { classifyWatchPath } from "../dist/server/watch_events.js";

import { currentManifest } from "./helpers/current_manifest.js";
import {
  createFixture,
  removeFixture,
  type TestFixture,
} from "./helpers/fixture.js";

const metadata = 'const metadata = { relatedDocs: ["notes.md"] };';

async function write(
  fixture: TestFixture,
  relative: string,
  contents: string,
): Promise<string> {
  const target = path.join(fixture.root, relative);
  await fs.promises.mkdir(path.dirname(target), { recursive: true });
  await fs.promises.writeFile(target, contents);
  return target;
}

async function coLocatedFixture(): Promise<TestFixture> {
  const fixture = await createFixture();
  await write(
    fixture,
    "src/components/button/button.tsx",
    'import React from "react";\nexport function Button(props: { label: string }) { return <button>{props.label}</button>; }\n',
  );
  await write(
    fixture,
    "src/components/button/button.mokly.tsx",
    `import React from "react";
import { defineComponent } from "@mokly/mokly";
import { Button } from "./button.js";
${metadata}
export const button = defineComponent({ ...metadata, path: "button", title: "Button", description: "A co-located button", propSchema: { kind: "object", properties: { label: { schema: { kind: "string" } } } },
  render: (props) => <Button label={props.label} />,
  variants: [{ slug: "default",  title: "Default", props: { label: "Continue" } }] });
`,
  );
  await write(
    fixture,
    "src/components/button/button.mockup.tsx",
    `import React from "react";
import { defineScreen } from "@mokly/mokly";
import { button } from "./button.mokly.js";
${metadata}
export const mockups = [...button.entries, defineScreen({ ...metadata, useCasePaths: [], path: "button-demo", title: "Button demo", description: "Uses the button", mobile: <main><button.Component label="Go" /></main>, desktop: <main><button.Component label="Go" /></main> })];
`,
  );
  await fs.promises.writeFile(
    fixture.configPath,
    `export default { roots: [{ dir: "entries", files: ["**/*.mockup.{ts,tsx}"] }, { dir: "src", files: ["**/*.mockup.{ts,tsx}"] }], mockupsDir: "mockups", repoRoot: ".", review: { outDir: ".review" } };\n`,
  );
  return fixture;
}

test("a component defined in a helper beside its implementation is attributed to that helper", async (t) => {
  const fixture = await coLocatedFixture();
  t.after(() => removeFixture(fixture));
  const config = await loadConfig(fixture.root);
  const compilation = await compileCatalogue(config);
  const button = compilation.manifest.entries.find(
    (entry) => entry.path === "button",
  );
  assert.equal(button?.sourcePath, "src/components/button/button.mokly.tsx");
  const demo = compilation.manifest.entries.find(
    (entry) => entry.path === "button-demo",
  );
  assert.equal(demo?.sourcePath, "src/components/button/button.mockup.tsx");
  assert.ok(
    compilation.manifest.sourceFiles.includes(
      "src/components/button/button.tsx",
    ),
  );
  assert.equal(demo?.kind, "screen");
  assert.equal(
    demo?.kind === "screen" &&
      (demo.componentViews ?? []).some((view) =>
        view.instances.some((instance) => instance.componentId === "button"),
      ),
    true,
  );
});

test("a screen defined in a helper that no entries glob matches is still attributed and accepted", async (t) => {
  const fixture = await createFixture();
  t.after(() => removeFixture(fixture));
  await write(
    fixture,
    "lib/screens.ts",
    `import { defineScreen } from "@mokly/mokly";
${metadata}
export const late = defineScreen({ ...metadata, useCasePaths: [], path: "late", title: "Late", description: "Defined in a helper", mobile: "Late", desktop: "Late" });
`,
  );
  await fs.promises.appendFile(
    fixture.entryPath,
    '\nimport { late } from "../lib/screens.js";\nmockups.push(late);\n',
  );
  const compilation = await compileCatalogue(await loadConfig(fixture.root));
  const late = compilation.manifest.entries.find(
    (entry) => entry.path === "late",
  );
  assert.equal(late?.sourcePath, "lib/screens.ts");
  assert.ok(compilation.manifest.sourceFiles.includes("lib/screens.ts"));
});

test("a definition created by an installed package is rejected as unattributed", async (t) => {
  const fixture = await createFixture();
  t.after(() => removeFixture(fixture));
  await write(
    fixture,
    "node_modules/@acme/mokups/package.json",
    '{ "name": "@acme/mokups", "type": "module", "main": "index.js" }\n',
  );
  await write(
    fixture,
    "node_modules/@acme/mokups/index.js",
    `import { defineScreen } from "@mokly/mokly";
export const packaged = defineScreen({ relatedDocs: [], useCasePaths: [], path: "packaged", title: "Packaged", description: "Defined by a package", mobile: "Packaged", desktop: "Packaged" });
`,
  );
  await fs.promises.appendFile(
    fixture.entryPath,
    '\nimport { packaged } from "@acme/mokups";\nmockups.push(packaged);\n',
  );
  await assert.rejects(compileCatalogue(await loadConfig(fixture.root)), {
    code: "build-invalid",
    message: /\[invalid-source\] <unattributed> \(packaged\)/,
  });
});

test("watch rebuilds for a new co-located entry module and export refuses its directory", async (t) => {
  const fixture = await coLocatedFixture();
  t.after(() => removeFixture(fixture));
  const config = await loadConfig(fixture.root);
  const created = path.join(
    fixture.root,
    "src/components/card/card.mockup.tsx",
  );
  assert.equal(
    classifyWatchPath({ path: created, kind: "change" }, config),
    "rebuild",
  );
  assert.equal(
    classifyWatchPath(
      {
        path: path.join(fixture.root, "src/components/card/card.tsx"),
        kind: "change",
      },
      config,
    ),
    "ignore",
  );
  assert.equal(
    classifyWatchPath(
      { path: path.join(fixture.root, "docs/card.mockup.tsx"), kind: "change" },
      config,
    ),
    "ignore",
  );
  const compiled = {
    ...config,
    ...(await compileCatalogue(config)).manifest,
  };
  const entryModules = [
    path.join(fixture.root, "entries/fixture.mockup.tsx"),
    path.join(fixture.root, "src/components/button/button.mockup.tsx"),
  ];
  const resolved = {
    ...config,
    entryModules,
    sourceFiles: compiled.sourceFiles,
  };
  assert.equal(
    resolveExportOutput(resolved, "site"),
    path.join(fixture.root, "site"),
  );
  for (const output of ["src/components/button", "src/components", "src"])
    assert.throws(() => resolveExportOutput(resolved, output), output);
});

test("runtime startup rejects missing or invalid resolved roots", async () => {
  const received = receiveComponentRuntimeStartup();
  const valid = {
    type: "component-runtime-startup",
    config: {
      configPath: "/repo/mokly.config.ts",
      roots: [
        { dir: "/repo/src", files: ["**/*.mockup.{ts,tsx}"], transparent: [] },
      ],
      mockupsDir: "/repo/generated",
      generatedDir: "/repo/generated/mokly-generated",
      repoRoot: "/repo",
    },
    manifest: currentManifest({
      entries: [],
      folders: [],
      schemaVersion: 9,
      sourceFiles: [],
    }),
  };
  process.emit("message", {
    ...valid,
    config: { ...valid.config, roots: undefined },
  });
  process.emit("message", {
    ...valid,
    config: {
      ...valid.config,
      roots: [{ dir: "/repo/src", files: ["ok", 1], transparent: [] }],
    },
  });
  process.emit("message", valid);
  const { config } = await received;
  assert.deepEqual(config.roots, valid.config.roots);
});
