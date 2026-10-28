import assert from "node:assert/strict";
import test from "node:test";

import type { BundleResult } from "../packages/mokly/src/generated/sidecar/BundleResult.js";
import type { RenderResult } from "../packages/mokly/src/generated/sidecar/RenderResult.js";

import { consumer } from "./helpers/mokly_serve.js";
import {
  bundleParams,
  installBindings,
  startSidecar,
} from "./helpers/sidecar.js";

// Both modules declare the same top-level name, so the bundler must rename one.
const screenModule = (name: string) => `
import React from 'react';
import {defineScreen} from '@mokly/mokly';
function Button() {
  const frame = new Error().stack!.split('\\n')[1]!.trim().split(' ')[1];
  return <p>{\`\${Button.name}:\${frame}\`}</p>;
}
export const ${name} = defineScreen({title:'${name}',description:'',relatedDocs:[],
  props:{},render:() => <Button/>});
`;

async function bundled(
  sidecar: ReturnType<typeof startSidecar>,
  root: string,
  entryFiles: string[],
) {
  const bundle = await sidecar.call<BundleResult>(
    "bundle",
    bundleParams({
      sourceRoot: root,
      renderer: null,
      entryFiles,
      storiesFiles: [],
    }),
  );
  await sidecar.call("cssModules", {
    generation: bundle.generation,
    classMaps: {},
  });
  return bundle.generation;
}

test(
  "functions keep their authored names when two modules declare the same name",
  { timeout: 120_000 },
  async (context) => {
    const root = await consumer(context, {
      "specs/first.mockup.tsx": screenModule("first"),
      "specs/second.mockup.tsx": screenModule("second"),
    });
    const sidecar = startSidecar(context, root);
    await sidecar.call("hello");
    const generation = await bundled(sidecar, root, [
      "specs/first.mockup.tsx",
      "specs/second.mockup.tsx",
    ]);
    await installBindings(sidecar, generation);
    for (const name of ["first", "second"]) {
      const rendered = await sidecar.call<RenderResult>("renderScreen", {
        generation,
        handle: `specs/${name}.mockup.tsx#${name}`,
        entry: { path: name, title: name },
        props: {},
        viewport: "mobile",
        colorScheme: "light",
      });
      assert.equal(rendered.html, "<p>Button:Button</p>", name);
    }
    await sidecar.call("shutdown");
  },
);
