import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import type { BundleResult } from "../packages/mokly/src/generated/sidecar/BundleResult.js";
import type { RenderResult } from "../packages/mokly/src/generated/sidecar/RenderResult.js";

import {
  bundleParams,
  installBindings,
  startSidecar,
} from "./helpers/sidecar.js";

const require = createRequire(import.meta.url);

test("React resolves from the configuration directory and obeys side aliases", async (context) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "mokly-peer-context-"));
  context.after(() => fs.rm(root, { recursive: true, force: true }));
  const configuration = path.join(root, "app");
  await fs.mkdir(path.join(configuration, "node_modules"), { recursive: true });
  await fs.mkdir(path.join(root, "node_modules/react"), { recursive: true });
  await fs.writeFile(
    path.join(root, "node_modules/react/package.json"),
    JSON.stringify({ name: "react", main: "index.js" }),
  );
  await fs.writeFile(
    path.join(root, "node_modules/react/index.js"),
    'throw new Error("wrong React from source root");',
  );
  for (const name of ["react", "react-dom", "alternate-react"])
    await fs.symlink(
      path.dirname(
        require.resolve(
          `${name === "alternate-react" ? "react" : name}/package.json`,
        ),
      ),
      path.join(configuration, "node_modules", name),
      "junction",
    );
  await fs.writeFile(
    path.join(root, "entry.mjs"),
    `import {createElement} from 'react'; import {defineScreen} from '@mokly/mokly'; export default defineScreen({title:'Config',description:'',relatedDocs:[],render:()=>createElement('main',null,'Config React')});`,
  );
  const sidecar = startSidecar(context);
  await sidecar.call("hello");
  const params = bundleParams({
    sourceRoot: root,
    configurationDirectory: "app",
    entryFiles: ["entry.mjs"],
    renderer: null,
    storiesFiles: [],
  });
  for (const aliases of [{}, { react: "alternate-react" }]) {
    const { generation } = await sidecar.call<BundleResult>("bundle", {
      ...params,
      moduleResolution: { ...params.moduleResolution, aliases },
    });
    await sidecar.call("cssModules", { generation, classMaps: {} });
    await installBindings(sidecar, generation);
    const result = await sidecar.call<RenderResult>("renderScreen", {
      generation,
      handle: "entry.mjs#default",
      entry: { path: "config", title: "Config" },
      props: {},
      viewport: "mobile",
      colorScheme: "light",
    });
    assert.equal(result.html, "<main>Config React</main>");
  }
});

test("missing Storybook reports bundle-failed with the missing package", async (context) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "mokly-no-storybook-"));
  context.after(() => fs.rm(root, { recursive: true, force: true }));
  await fs.writeFile(
    path.join(root, "entry.stories.mjs"),
    "export default {}; export const Primary={};",
  );
  const sidecar = startSidecar(context);
  await sidecar.call("hello");
  await assert.rejects(
    sidecar.call(
      "bundle",
      bundleParams({
        sourceRoot: root,
        entryFiles: [],
        storiesFiles: ["entry.stories.mjs"],
        moduleResolution: {
          ...bundleParams().moduleResolution,
          packageRoots: [],
        },
        renderer: null,
      }),
    ),
    { code: "bundle-failed", message: /@storybook\/react/ },
  );
});
