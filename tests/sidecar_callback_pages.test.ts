import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import type { PageResult } from "../packages/mokly/src/generated/sidecar/PageResult.js";

import { startSidecar } from "./helpers/sidecar.js";
import {
  callbackConsumer,
  callbackEntry,
  describeCallbacks,
} from "./helpers/sidecar_callbacks.js";

const document = (revision: string) =>
  `<!doctype html><html><head><title>Handbook</title></head><body><main>${revision}: call 1</main></body></html>`;
const helper = (
  revision: string,
) => `let calls=0; export function renderDocument(){
  if(++calls!==1) throw new Error('repeated page helper call');
  return ${JSON.stringify(document(revision))};
}`;

test(
  "pages call an imported helper once per generation",
  { timeout: 120_000 },
  async (context) => {
    const root = await callbackConsumer(
      context,
      `
import {renderDocument} from '../document.source';
export const page=definePage({...metadata,path:'handbook',title:'Handbook',render:renderDocument});
`,
      {
        "mokly.config.json":
          '{"renderer":"renderer.ts","colorSchemes":["light","dark"]}',
        "document.source.ts": helper("First"),
        "renderer.ts":
          "export default () => {throw new Error('screen renderer must not render pages');};",
      },
    );
    const sidecar = startSidecar(context, root);
    await sidecar.call("hello");
    let previous: string | undefined;
    for (const revision of ["First", "Second"]) {
      await fs.writeFile(
        path.join(root, "document.source.ts"),
        helper(revision),
      );
      const { generation, definitions, bundle } = await describeCallbacks(
        sidecar,
        root,
        "renderer.ts",
      );
      assert.notEqual(generation, previous);
      previous = generation;
      assert.equal(definitions.pages.length, 1);
      assert.equal(definitions.pages[0]!.sourcePath, callbackEntry);
      assert.ok(
        bundle.modules.some((module) => module.path === "document.source.ts"),
      );
      const page = await sidecar.call<PageResult>("renderPage", {
        generation,
        handle: `${callbackEntry}#page`,
      });
      assert.equal(page.html, document(revision));
    }
    await sidecar.call("shutdown");
  },
);
