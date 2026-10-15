import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import type { BundleResult } from "../packages/mokly/src/generated/sidecar/BundleResult.js";
import type { RenderResult } from "../packages/mokly/src/generated/sidecar/RenderResult.js";

import {
  bundleParams,
  installBindings,
  startSidecar,
} from "./helpers/sidecar.js";
import { sidecarSources } from "./helpers/sidecar_sources.js";

test("identical head and base sources keep independent maps and bindings", async (context) => {
  const { head, base } = await sidecarSources(context);
  const source = `import {createElement} from 'react'; import {defineComponent,defineScreen} from '@mokly/mokly'; import styles from './card.module.css'; export const card=defineComponent({title:'Card',description:'',relatedDocs:[],propSchema:{type:'object',additionalProperties:false},render:()=>createElement('b',{className:styles.card},'Card')}); export const screen=defineScreen({title:'Screen',description:'',relatedDocs:[],render:()=>createElement(card.Component)});`;
  const sidecar = startSidecar(context);
  await sidecar.call("hello");
  const generations: string[] = [];
  for (const [root, name] of [
    [head, "head"],
    [base, "base"],
  ]) {
    await fs.writeFile(path.join(root!, "entry.mjs"), source);
    await fs.writeFile(path.join(root!, "card.module.css"), ".card {}");
    const { generation } = await sidecar.call<BundleResult>(
      "bundle",
      bundleParams({
        sourceRoot: root!,
        entryFiles: ["entry.mjs"],
        storiesFiles: [],
        renderer: null,
      }),
    );
    await sidecar.call("cssModules", {
      generation,
      classMaps: { "card.module.css": { card: `${name}-card` } },
    });
    await installBindings(sidecar, generation, {
      "entry.mjs#card": { path: `${name}/card`, title: "Card" },
      "entry.mjs#screen": { path: `${name}/screen`, title: "Screen" },
    });
    generations.push(generation);
  }
  assert.notEqual(generations[0], generations[1]);
  for (const [index, name] of [
    [0, "head"],
    [1, "base"],
    [0, "head"],
  ] as const) {
    const result = await sidecar.call<RenderResult>("renderScreen", {
      generation: generations[index],
      handle: "entry.mjs#screen",
      entry: { path: `${name}/screen`, title: "Screen" },
      props: {},
      viewport: "mobile",
      colorScheme: "light",
    });
    assert.match(result.html, new RegExp(`path="${name}/card"`));
    assert.match(result.html, new RegExp(`class="${name}-card"`));
  }
});

test("generation identity hashes the selected physical dependency roots", async (context) => {
  const { root, head, base } = await sidecarSources(context);
  await fs.writeFile(path.join(head, "entry.mjs"), "export const fixture=1;");
  for (const directory of [base, path.join(root, "other")])
    await fs.mkdir(path.join(directory, "node_modules"), { recursive: true });
  const selected = path.join(root, "selected");
  await fs.mkdir(selected);
  const link = path.join(selected, "node_modules");
  await fs.symlink(path.join(base, "node_modules"), link, "junction");
  const sidecar = startSidecar(context);
  await sidecar.call("hello");
  const params = bundleParams({
    sourceRoot: head,
    entryFiles: ["entry.mjs"],
    storiesFiles: [],
    renderer: null,
    moduleResolution: {
      ...bundleParams().moduleResolution,
      packageRoots: [selected],
    },
  });
  const first = await sidecar.call<BundleResult>("bundle", params);
  await fs.unlink(link);
  await fs.symlink(path.join(root, "other/node_modules"), link, "junction");
  assert.notEqual(
    (await sidecar.call<BundleResult>("bundle", params)).generation,
    first.generation,
  );
});
