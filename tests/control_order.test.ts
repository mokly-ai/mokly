import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { readEntryDetail } from "../packages/viewer/src/catalogue/detail_reader.js";
import { readCatalogueIndex } from "../packages/viewer/src/catalogue/index_reader.js";
import { controlEntries } from "../packages/viewer/src/shell/control_values.js";

import { consumer } from "./helpers/mokly_serve.js";
import { command } from "./helpers/static_publication.js";

test(
  "entry details retain declared, schema, and inferred control order",
  { timeout: 120_000 },
  async (context) => {
    const root = await consumer(context, {
      "specs/html.screen.html": `---
title: HTML
propSchema: {type: object, additionalProperties: false, properties: {zulu: {type: string}, alpha: {type: number}}}
props: {alpha: 1, zulu: Saved}
variants: [{slug: other, title: Other, props: {alpha: 2}}]
---
<p>{{zulu}} {{alpha}}</p>`,
      "specs/entries.mockup.ts": `import React from 'react'; import {defineScreen} from '@mokly/mokly';
      const render = () => React.createElement('p',null,'Order');
      export const declared = defineScreen({path:'declared',title:'Declared',description:'',relatedDocs:[],
        props:{alpha:1,zulu:1},controls:{zulu:{kind:'number'},alpha:{kind:'number'}},render});
      export const inferred = defineScreen({path:'inferred',title:'Inferred',description:'',relatedDocs:[],
        props:{zulu:1,alpha:1},variants:[{slug:'other',title:'Other',props:{middle:true}}],render});
      export const schema = defineScreen({path:'schema',title:'Schema',description:'',relatedDocs:[],
        propSchema:{type:'object',additionalProperties:false,properties:{zulu:{type:'number'},alpha:{type:'number'}}},
        props:{alpha:1,zulu:1},render});`,
      "specs/story.stories.ts": `import React from 'react';
      export default {title:'Story',component:()=>React.createElement('p',null,'Story'),args:{zulu:1,alpha:1}};
      export const Other = {args:{middle:true}};`,
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
    const output = path.join(root, "mokly-static/mokly-viewer");
    const index = readCatalogueIndex(
      JSON.parse(await fs.readFile(path.join(output, "index.json"), "utf8")),
    );
    for (const [name, expected] of [
      ["html", ["zulu", "alpha"]],
      ["html/other", ["zulu", "alpha"]],
      ["declared", ["zulu", "alpha"]],
      ["schema", ["zulu", "alpha"]],
      ["inferred", ["zulu", "alpha", "middle"]],
      ["inferred/other", ["zulu", "alpha", "middle"]],
      ["story", ["zulu", "alpha", "middle"]],
      ["story/Other", ["zulu", "alpha", "middle"]],
    ] as const) {
      const detail = readEntryDetail(
        JSON.parse(
          await fs.readFile(
            path.join(output, "entries", `${name}.json`),
            "utf8",
          ),
        ),
      );
      assert.deepEqual(detail.controlOrder, expected, name);
      const entry = [...index.screens, ...index.components].find(
        (entry) => entry.path === name,
      )!;
      assert.deepEqual(
        controlEntries({
          controls: entry.controls,
          controlOrder: detail.controlOrder,
        }).map(([key]) => key),
        expected,
        name,
      );
    }
  },
);
