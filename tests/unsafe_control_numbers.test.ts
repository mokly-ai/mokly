import assert from "node:assert/strict";
import test from "node:test";

import { readCatalogueIndex } from "../packages/viewer/src/catalogue/index_reader.js";
import { readLiveDescriptor } from "../packages/viewer/src/catalogue/live_reader.js";

import { completed, consumer, serve } from "./helpers/mokly_serve.js";
import { command } from "./helpers/static_publication.js";

for (const [name, schema, control] of [
  [
    "number",
    "{type:'integer',minimum:count,maximum:count}",
    "{kind:'number',maximum:count}",
  ],
  [
    "text",
    "{type:'string',minLength:count,maxLength:count}",
    "{kind:'text',maxLength:count}",
  ],
  [
    "select",
    "{enum:[count]}",
    "{kind:'select',options:[{label:'Large',value:count}]}",
  ],
]) {
  test(
    `unsafe ${name} controls keep their schema values during builds and live edits`,
    { timeout: 120_000 },
    async (context) => {
      const root = await consumer(context, {
        "specs/number.mockup.ts": `import React from 'react';
import {defineScreen} from '@mokly/mokly';
const count=1000000000000000100;
export default defineScreen({title:'Number',description:'',relatedDocs:[],
  propSchema:{type:'object',additionalProperties:false,properties:{count:${schema}}},
  props:{},controls:{count:${control}},render:()=>React.createElement('p',null,'Number')});`,
      });
      const result = await command(
        root,
        "build",
        ["--no-changes"],
        "plain",
        {},
        context.signal,
      ).result;
      assert.equal(result.code, 0, result.stderr);
      const server = await serve(context, root);
      const url = await server.ready();
      const { index: raw } = await completed(url, server.signal, "number");
      const index = readCatalogueIndex(raw);
      const live = readLiveDescriptor(
        await (await fetch(`${url}/mokly-viewer/live.json`)).json(),
      );
      const response = await fetch(`${url}${live.render.url}`, {
        method: "POST",
        signal: context.signal,
        headers: {
          "content-type": "application/json",
          origin: url,
          "x-mokly-render-token": live.render.token,
        },
        body: JSON.stringify({
          entryPath: "number",
          viewport: "mobile",
          colorScheme: "light",
          revision: index.revision,
          pageId: "a".repeat(32),
          overrides:
            name === "text"
              ? {}
              : { count: { kind: "set", value: 1000000000000000100 } },
        }),
      });
      assert.equal(response.status, 200, await response.text());
    },
  );
}

test(
  "unsafe story control hints retain binary64 limits for live edits",
  { timeout: 120_000 },
  async (context) => {
    const root = await consumer(context, {
      "specs/number.stories.tsx": `import React from 'react';
const count=1000000000000000100;
export default {title:'Number',component:({count})=>React.createElement('p',null,count),
  args:{count},argTypes:{count:{control:{type:'number',min:count,max:count}}}};
export const Saved={};`,
    });
    const server = await serve(context, root);
    const url = await server.ready();
    const { index: raw } = await completed(url, server.signal, "number");
    const index = readCatalogueIndex(raw);
    const live = readLiveDescriptor(
      await (await fetch(`${url}/mokly-viewer/live.json`)).json(),
    );
    const response = await fetch(`${url}${live.render.url}`, {
      method: "POST",
      signal: context.signal,
      headers: {
        "content-type": "application/json",
        origin: url,
        "x-mokly-render-token": live.render.token,
      },
      body: JSON.stringify({
        entryPath: index.components[0]!.path,
        viewport: "mobile",
        colorScheme: "light",
        revision: index.revision,
        pageId: "b".repeat(32),
        overrides: { count: { kind: "set", value: 1000000000000000100 } },
      }),
    });
    assert.equal(response.status, 200, await response.text());
  },
);

test(
  "an omitted integer control step keeps its schema multiple",
  { timeout: 120_000 },
  async (context) => {
    const root = await consumer(context, {
      "specs/number.mockup.ts": `import React from 'react';
import {defineScreen} from '@mokly/mokly';
export default defineScreen({title:'Number',description:'',relatedDocs:[],
  propSchema:{type:'object',additionalProperties:false,properties:{count:{type:'integer',multipleOf:0.5}}},
  props:{count:0},controls:{count:{kind:'number'}},render:({count})=>React.createElement('p',null,count)});`,
    });
    const result = await command(
      root,
      "build",
      ["--no-changes"],
      "plain",
      {},
      context.signal,
    ).result;
    assert.equal(result.code, 0, result.stderr);
  },
);
