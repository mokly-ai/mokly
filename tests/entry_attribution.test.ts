import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import { compileCatalogue } from "../dist/build/compile.js";
import {
  generatedHeader,
  isAuthoredOwner,
  pendingGeneratedOrphanRoutes,
} from "../dist/build/ownership.js";
import { loadConfig } from "../dist/config/load.js";
import { resolvePublicExclude } from "../dist/config/public_exclusions.js";
import { resolveExportOutput } from "../dist/export/paths.js";
import { receiveComponentRuntimeStartup } from "../dist/server/controls/runtime_ipc.js";
import { classifyWatchPath } from "../dist/server/watch_events.js";

import {
  createFixture,
  removeFixture,
  type TestFixture,
} from "./helpers/fixture.js";

const metadata =
  'const metadata = { dependencies: ["notes.md"], relatedDocs: ["notes.md"] };';

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
export const button = defineComponent({ ...metadata, id: "button", title: "Button", description: "A co-located button", route: "components/button.html",
  propSchema: { kind: "object", properties: { label: { schema: { kind: "string" } } } },
  render: (props) => <Button label={props.label} />,
  variants: [{ id: "default", title: "Default", props: { label: "Continue" } }] });
`,
  );
  await write(
    fixture,
    "src/components/button/button.mockup.tsx",
    `import React from "react";
import { defineScreen } from "@mokly/mokly";
import { button } from "./button.mokly.js";
${metadata}
export const mockups = [button.entry, defineScreen({ ...metadata, useCaseIds: [], id: "button-demo", title: "Button demo", description: "Uses the button", route: "screens/button-demo.html", mobile: <main><button.Component label="Go" /></main>, desktop: <main><button.Component label="Go" /></main> })];
`,
  );
  await fs.promises.writeFile(
    fixture.configPath,
    `export default { entries: ["entries/**/*.mockup.{ts,tsx}", "src/**/*.mockup.{ts,tsx}"], mockupsDir: "mockups", repoRoot: ".", review: { outDir: ".review" } };\n`,
  );
  return fixture;
}

test("a component defined in a helper beside its implementation is attributed to that helper", async (t) => {
  const fixture = await coLocatedFixture();
  t.after(() => removeFixture(fixture));
  const config = await loadConfig(fixture.root);
  const compilation = await compileCatalogue(config);
  const button = compilation.manifest.entries.find(
    (entry) => entry.id === "button",
  );
  assert.equal(button?.sourcePath, "src/components/button/button.mokly.tsx");
  assert.deepEqual(button?.dependencies, [
    "notes.md",
    "src/components/button/button.mokly.tsx",
  ]);
  const demo = compilation.manifest.entries.find(
    (entry) => entry.id === "button-demo",
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
export const late = defineScreen({ ...metadata, useCaseIds: [], id: "late", title: "Late", description: "Defined in a helper", route: "screens/late.html", mobile: "Late", desktop: "Late" });
`,
  );
  await fs.promises.appendFile(
    fixture.entryPath,
    '\nimport { late } from "../lib/screens.js";\nmockups.push(late);\n',
  );
  const compilation = await compileCatalogue(await loadConfig(fixture.root));
  const late = compilation.manifest.entries.find(
    (entry) => entry.id === "late",
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
export const packaged = defineScreen({ dependencies: [], relatedDocs: [], useCaseIds: [], id: "packaged", title: "Packaged", description: "Defined by a package", route: "screens/packaged.html", mobile: "Packaged", desktop: "Packaged" });
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

test("ownership trusts resolved, inventoried, and glob-matched sources", async (t) => {
  const fixture = await coLocatedFixture();
  t.after(() => removeFixture(fixture));
  const config = await loadConfig(fixture.root);
  const inventoried = {
    ...config,
    sourceFiles: (await compileCatalogue(config)).manifest.sourceFiles,
  };
  const rootGlob = {
    ...inventoried,
    entryGlobs: ["**/*.mockup.{ts,tsx}"],
  };
  const scopedGlob = { ...rootGlob, entryGlobs: ["src/**/*.mockup.{ts,tsx}"] };
  assert.equal(
    isAuthoredOwner("other/catalogue/thing.mockup.tsx", rootGlob),
    true,
  );
  assert.equal(isAuthoredOwner("docs/notes.md", rootGlob), false);
  assert.equal(
    isAuthoredOwner("other/catalogue/thing.mockup.tsx", scopedGlob),
    false,
  );
  assert.equal(isAuthoredOwner("docs/notes.md", scopedGlob), false);
  assert.equal(
    isAuthoredOwner("src/components/button/button.mockup.tsx", inventoried),
    true,
  );
  assert.equal(
    isAuthoredOwner("src/components/button/button.mokly.tsx", inventoried),
    true,
  );
  assert.equal(
    isAuthoredOwner("src/components/button/button.mokly.tsx", {
      ...inventoried,
      sourceFiles: [],
    }),
    false,
  );
  const stale = path.join(fixture.mockupsDir, "screens/stale.html");
  await fs.promises.mkdir(path.dirname(stale), { recursive: true });
  await fs.promises.writeFile(
    stale,
    `${generatedHeader("src/components/button/old-name.mockup.tsx")}<html></html>\n`,
  );
  assert.deepEqual(pendingGeneratedOrphanRoutes(inventoried, []), [
    "screens/stale.html",
  ]);
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

test("runtime startup rejects a message without entry globs", async () => {
  const received = receiveComponentRuntimeStartup();
  const valid = {
    type: "component-runtime-startup",
    config: {
      configPath: "/repo/mokly.config.ts",
      entryGlobs: ["src/**/*.mockup.{ts,tsx}"],
      mockupsDir: "/repo/generated",
      repoRoot: "/repo",
      publicExclude: resolvePublicExclude([]),
    },
    manifest: { entries: [], schemaVersion: 5, sourceFiles: [] },
  };
  process.emit("message", {
    ...valid,
    config: { ...valid.config, entryGlobs: undefined, entriesDir: "/repo/e" },
  });
  process.emit("message", {
    ...valid,
    config: { ...valid.config, entryGlobs: ["ok", 1] },
  });
  process.emit("message", valid);
  const { config } = await received;
  assert.deepEqual(config.entryGlobs, ["src/**/*.mockup.{ts,tsx}"]);
});
