import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { readCatalogueIndex } from "../packages/viewer/src/catalogue/index_reader.js";
import { decodeProps } from "../packages/viewer/src/components/codec.js";

import { consumer } from "./helpers/mokly_serve.js";
import { command } from "./helpers/static_publication.js";

test(
  "unsafe nested React props warn and strict keeps the installed output",
  { timeout: 120_000 },
  async (context) => {
    const root = await consumer(context, {
      "specs/entries.mockup.ts": `import React from 'react'; import {defineComponent,defineScreen} from '@mokly/mokly';
      export const count=defineComponent({path:'count',title:'Count',description:'',relatedDocs:[],
        propSchema:{type:'object',additionalProperties:false,properties:{count:{type:'integer'}},required:['count']},
        props:{count:0},render:({count})=>React.createElement('p',null,count)});
      export const home=defineScreen({path:'home',title:'Home',description:'',relatedDocs:[],
        render:()=>React.createElement(count.Component,{count:9007199254740993})});`,
    });
    const built = await command(
      root,
      "build",
      ["--no-changes"],
      "plain",
      {},
      context.signal,
    ).result;
    assert.equal(built.code, 0, built.stderr);
    assert.equal(
      built.stderr.match(/outside the JavaScript safe integer range/g)?.length,
      1,
      built.stderr,
    );
    const index = path.join(root, "mokly-static/mokly-viewer/index.json");
    const previous = await fs.readFile(index);
    const strict = await command(
      root,
      "build",
      ["--no-changes", "--strict"],
      "plain",
      {},
      context.signal,
    ).result;
    assert.equal(strict.code, 1, strict.stderr);
    assert.match(strict.stderr, /1 build warning with --strict/);
    assert.deepEqual(await fs.readFile(index), previous);
  },
);

test(
  "unsafe literal component props use the rounded value before validation",
  { timeout: 120_000 },
  async (context) => {
    const root = await consumer(context, {
      "specs/number.component.html": `---
title: Number
element: ui-number
propSchema: {type: object, additionalProperties: false, properties: {count: {type: integer, maximum: 9007199254740992}}}
props: {count: 0}
---
<p>{{count}}</p>`,
      "specs/home.screen.html":
        "---\ntitle: Home\n---\n<ui-number count='9007199254740993'></ui-number>",
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
    assert.equal(
      result.stderr.match(/outside the JavaScript safe integer range/g)?.length,
      2,
      result.stderr,
    );
    const html = await fs.readFile(
      path.join(
        root,
        "mokly-static/static/mokly-generated/home/index.mobile.html",
      ),
      "utf8",
    );
    assert.match(html, /<p>9007199254740992<\/p>/);
  },
);

test(
  "unsafe saved integers round before schema validation and match viewer props",
  { timeout: 120_000 },
  async (context) => {
    const root = await consumer(context, {
      "specs/number.screen.html": `---
title: Number
propSchema:
  type: object
  additionalProperties: false
  properties:
    count: {type: integer, maximum: 9007199254740992}
props: {count: 9007199254740993}
variants:
  - {slug: negative, title: Negative, props: {count: -9007199254740993}}
  - {slug: safe, title: Safe, props: {count: 9007199254740991}}
---
<p>{{count}}</p>`,
    });
    const built = await command(
      root,
      "build",
      ["--no-changes"],
      "plain",
      {},
      context.signal,
    ).result;
    assert.equal(built.code, 0, built.stderr);
    assert.equal(
      built.stderr.match(/outside the JavaScript safe integer range/g)?.length,
      3,
      built.stderr,
    );
    const index = readCatalogueIndex(
      JSON.parse(
        await fs.readFile(
          path.join(root, "mokly-static/mokly-viewer/index.json"),
          "utf8",
        ),
      ),
    );
    assert.equal(decodeProps(index.screens[0]!.props).count, 9007199254740992);
    assert.equal(decodeProps(index.screens[1]!.props).count, -9007199254740992);
    assert.equal(decodeProps(index.screens[2]!.props).count, 9007199254740991);
    const document = await fs.readFile(
      path.join(
        root,
        "mokly-static/static/mokly-generated/number/index.mobile.html",
      ),
      "utf8",
    );
    assert.match(document, /<p>9007199254740992<\/p>/);
    const strict = await command(
      root,
      "build",
      ["--no-changes", "--strict"],
      "plain",
      {},
      context.signal,
    ).result;
    assert.equal(strict.code, 1, strict.stderr);
    assert.match(strict.stderr, /3 build warnings with --strict/);
  },
);
