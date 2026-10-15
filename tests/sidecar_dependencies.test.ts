import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import type { BundleResult } from "../packages/mokly/src/generated/sidecar/BundleResult.js";
import type { PageResult } from "../packages/mokly/src/generated/sidecar/PageResult.js";
import type { RenderResult } from "../packages/mokly/src/generated/sidecar/RenderResult.js";

import {
  bundleParams,
  installBindings,
  startSidecar,
} from "./helpers/sidecar.js";
import { dependency, sidecarSources } from "./helpers/sidecar_sources.js";

test("base package CSS and JavaScript use stable dependency graph names", async (context) => {
  const { head, base } = await sidecarSources(context);
  const pkg = await dependency(head, "pkg", 'export const value="Installed";');
  await fs.writeFile(path.join(pkg, "style.css"), ".installed {color:red}");
  const source = `import {definePage} from '@mokly/mokly'; import {value} from 'pkg'; import 'pkg/style.css'; export default definePage({title:'Dependency',description:'',relatedDocs:[],render:()=>'<html>'+value+'</html>'});`;
  const sidecar = startSidecar(context);
  await sidecar.call("hello");
  const graphs: BundleResult["modules"][] = [];
  for (const sourceRoot of [head, base]) {
    await fs.writeFile(path.join(sourceRoot, "entry.mjs"), source);
    const result = await sidecar.call<BundleResult>(
      "bundle",
      bundleParams({
        sourceRoot,
        entryFiles: ["entry.mjs"],
        storiesFiles: [],
        renderer: null,
        moduleResolution: {
          ...bundleParams().moduleResolution,
          packageRoots: [head],
        },
      }),
    );
    assert.ok(
      result.modules.some(
        (module) => module.path === "node_modules/pkg/index.mjs",
      ),
    );
    assert.ok(
      result.modules.some(
        (module) => module.path === "node_modules/pkg/style.css",
      ),
    );
    assert.ok(
      result.modules.every((module) =>
        [module.path, ...module.imports].every(
          (name) => !name.startsWith("../") && !path.isAbsolute(name),
        ),
      ),
    );
    graphs.push(result.modules);
    await sidecar.call("cssModules", {
      generation: result.generation,
      classMaps: {},
    });
    await installBindings(sidecar, result.generation);
    assert.equal(
      (
        await sidecar.call<PageResult>("renderPage", {
          generation: result.generation,
          handle: "entry.mjs#default",
        })
      ).html,
      "<html>Installed</html>",
    );
  }
  assert.deepEqual(graphs[0], graphs[1]);
});

for (const extension of ["mjs", "css"])
  test(`a ${extension} import outside source and dependency roots fails at its importer`, async (context) => {
    const { root, head, base } = await sidecarSources(context);
    await fs.writeFile(
      path.join(root, `outside.${extension}`),
      extension === "css" ? ".x{}" : "export const x=1;",
    );
    await fs.writeFile(
      path.join(base, "entry.mjs"),
      `import '../outside.${extension}';`,
    );
    const sidecar = startSidecar(context);
    await sidecar.call("hello");
    await assert.rejects(
      sidecar.call(
        "bundle",
        bundleParams({
          sourceRoot: base,
          entryFiles: ["entry.mjs"],
          storiesFiles: [],
          renderer: null,
        }),
      ),
      {
        code: "bundle-failed",
        message: new RegExp(
          `^Build failed with 1 error:\\nentry.mjs:1:7: ERROR: \\[plugin: mokly-consumer\\] module outside\\.${extension} is outside sourceRoot and selected dependency roots$`,
        ),
      },
    );
    await fs.mkdir(path.join(head, "packages/local"), { recursive: true });
    await fs.writeFile(
      path.join(head, `packages/local/index.${extension}`),
      extension === "css" ? ".x{}" : "export const x=1;",
    );
    await fs.writeFile(
      path.join(base, "entry.mjs"),
      `import ${JSON.stringify(path.join(head, `packages/local/index.${extension}`))};`,
    );
    await assert.rejects(
      sidecar.call(
        "bundle",
        bundleParams({
          sourceRoot: base,
          repositoryRoots: [head],
          entryFiles: ["entry.mjs"],
          storiesFiles: [],
          renderer: null,
        }),
      ),
      {
        code: "bundle-failed",
        message: new RegExp(
          `^Build failed with 1 error:\\nentry.mjs:1:7: ERROR: \\[plugin: mokly-consumer\\] module packages/local/index\\.${extension} has no source in this side$`,
        ),
      },
    );
  });

test("base package JSX renders wrappers without catalogue source attribution", async (context) => {
  const { head, base } = await sidecarSources(context);
  await dependency(
    head,
    "pkg",
    "export function Shell({Card}){return <Card/>;}",
    "jsx",
  );
  await fs.writeFile(
    path.join(base, "entry.mjs"),
    `import {createElement} from 'react'; import {defineComponent,defineScreen} from '@mokly/mokly'; import {Shell} from 'pkg'; export const card=defineComponent({title:'Card',description:'',relatedDocs:[],propSchema:{type:'object',additionalProperties:false},render:()=>createElement('b',null,'Dependency JSX')}); export const screen=defineScreen({title:'Screen',description:'',relatedDocs:[],render:()=>createElement(Shell,{Card:card.Component})});`,
  );
  const sidecar = startSidecar(context);
  await sidecar.call("hello");
  const { generation } = await sidecar.call<BundleResult>(
    "bundle",
    bundleParams({
      sourceRoot: base,
      entryFiles: ["entry.mjs"],
      storiesFiles: [],
      renderer: null,
      moduleResolution: {
        ...bundleParams().moduleResolution,
        packageRoots: [head, path.resolve(".")],
      },
    }),
  );
  await sidecar.call("cssModules", { generation, classMaps: {} });
  await installBindings(sidecar, generation, {
    "entry.mjs#card": { path: "components/card", title: "Card" },
    "entry.mjs#screen": { path: "screen", title: "Screen" },
  });
  const rendered = await sidecar.call<RenderResult>("renderScreen", {
    generation,
    handle: "entry.mjs#screen",
    entry: { path: "screen", title: "Screen" },
    props: {},
    viewport: "mobile",
    colorScheme: "light",
  });
  assert.match(rendered.html, /Dependency JSX/);
  assert.equal(rendered.instances[0]?.source, undefined);
});
