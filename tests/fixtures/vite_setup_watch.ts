import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import type { TestContext } from "node:test";

import { readCatalogueIndex } from "../../packages/viewer/src/catalogue/index_reader.js";
import { consumer, serve } from "../helpers/mokly_serve.js";
import { write } from "../helpers/static_changes.js";

import { component, htmlScreen, stylesheetConfig } from "./vite_stylesheets.js";

const rebuildRule = { rules: [{ action: "rebuild", paths: ["data/*.txt"] }] };

export function rebuildFixture(context: TestContext, vite: boolean) {
  return consumer(context, {
    "mokly.config.json": stylesheetConfig([], { vite, watch: rebuildRule }),
    "vite.config.ts": `import { readFileSync, readdirSync } from 'node:fs';
const directory = new URL('./data/', import.meta.url);
const text = readdirSync(directory).filter(name => name.endsWith('.txt')).sort()
  .map(name => readFileSync(new URL(name, directory), 'utf8')).join('|');
export default { define: { __COPY__: JSON.stringify(text) } };`,
    "src/card.mockup.tsx": component(
      "",
      vite ? "<p>{__COPY__}</p>" : "<p>esbuild</p>",
    ),
    "data/copy.txt": "before",
  });
}

export function broadRebuildFixture(context: TestContext) {
  const screen = (
    name: string,
    imports: string,
    contents: string,
  ) => `${imports}
import { defineScreen } from '@mokly/mokly';
export default defineScreen({ path: '${name}', title: '${name}', description: '', relatedDocs: [],
  render: () => <p>{${contents}}|{__COPY__}</p>,
});`;
  return consumer(context, {
    "mokly.config.json": stylesheetConfig(["src/site.css"], {
      watch: { rules: [{ action: "rebuild", paths: ["src/**"] }] },
    }),
    "vite.config.ts": `import { appendFileSync, readFileSync } from 'node:fs';
appendFileSync(new URL('./setups.log', import.meta.url), 'setup\\n');
const { copy } = JSON.parse(readFileSync(new URL('./src/copy.json', import.meta.url), 'utf8'));
export default { define: { __COPY__: JSON.stringify(copy) } };`,
    "setups.log": "",
    "src/copy.json": '{"copy":"before"}',
    "src/helper.ts": 'export const label = "helper-before";',
    "src/site.css": ".card { color: teal }",
    "src/card.mockup.tsx": screen(
      "card",
      'import { label } from "./helper";',
      "label",
    ),
    "src/other.mockup.tsx": screen("other", "", '"other"'),
  });
}

export function setups(root: string) {
  return fs.readFile(path.join(root, "setups.log"), "utf8");
}

export function postcssFixture(
  context: TestContext,
  rebuildFiles: string[] = [],
) {
  return consumer(context, {
    "mokly.config.json": stylesheetConfig(
      ["styles/site.css"],
      rebuildFiles.length
        ? { watch: { rules: [{ action: "rebuild", paths: rebuildFiles }] } }
        : undefined,
    ),
    "vite.config.ts": `import { join } from 'node:path';
export default { root: 'app', css: { postcss: join(import.meta.dirname, 'tools/css') } };`,
    "package.json": '{"private":true,"workspaces":["app"]}',
    "app/package.json": '{"private":true}',
    "tools/css/.gitkeep": "",
    "src/home.screen.html": htmlScreen,
    "styles/site.css": ".site { color: teal }",
  });
}

export function postcssConfig(color: string) {
  return `module.exports = ${postcssPlugins(JSON.stringify(color))};`;
}

export function postcssPlugins(colorExpression: string) {
  return `{ plugins: [{ postcssPlugin: 'color', Once(root) {
    root.walkDecls('color', decl => { decl.value = ${colorExpression}; });
  } }] }`;
}

export async function withSetupWatch(
  context: TestContext,
  root: string,
  check: (watch: {
    publish: (edit: () => Promise<void>) => Promise<void>;
    read: (route: string) => Promise<string>;
    write: (file: string, text: string) => Promise<void>;
    remove: (file: string) => Promise<void>;
  }) => Promise<void>,
) {
  const server = await serve(context, root, process.env, [], true);
  const url = await server.ready();
  const signal = AbortSignal.any([context.signal, server.signal]);
  const events = await fetch(`${url}/mokly-viewer/events`, { signal });
  assert.equal(events.status, 200);
  assert.ok(events.body);
  const updates = events.body.getReader();
  const generation = async () => {
    const response = await fetch(`${url}/mokly-viewer/index.json`, { signal });
    assert.equal(response.status, 200);
    return readCatalogueIndex(await response.json()).live?.generation;
  };
  try {
    await check({
      publish: async (edit) => {
        const previous = await generation();
        assert.ok(previous);
        await edit();
        while ((await generation()) === previous) {
          assert.equal(
            (await updates.read()).done,
            false,
            server.output.stderr,
          );
        }
      },
      read: async (route) => {
        const response = await fetch(`${url}/static/mokly-generated/${route}`, {
          signal,
        });
        const text = await response.text();
        assert.equal(response.status, 200, text);
        return text;
      },
      write: (file, text) => write(root, file, text),
      remove: (file) => fs.rm(path.join(root, file)),
    });
  } finally {
    if (!signal.aborted) await updates.cancel();
    await server.close();
  }
}
