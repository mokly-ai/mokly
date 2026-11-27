import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { readCatalogueIndex } from "../packages/viewer/src/catalogue/index_reader.js";

import { consumer } from "./helpers/mokly_serve.js";
import { command } from "./helpers/static_publication.js";

const component = (step: number) => `
import React from 'react';
import {defineComponent} from '@mokly/mokly';
export default defineComponent({path:'count',title:'Count',description:'',relatedDocs:[],
  propSchema:{type:'object',additionalProperties:false,properties:{count:{type:'integer',multipleOf:2}}},
  props:{count:6},controls:{count:{kind:'number',minimum:0,maximum:4,step:${step}}},
  variants:[{slug:'valid',title:'Valid',props:{count:0}}],
  render:({count})=>React.createElement('p',null,count)});
`;

test(
  "saved props and story args outside control bounds warn before strict failure",
  { timeout: 120_000 },
  async (context) => {
    const root = await consumer(context, {
      "specs/count.mockup.ts": component(2),
      "specs/story.stories.ts": `import React from 'react';
      export default {title:'Count story',component:({count})=>React.createElement('p',null,count),
        args:{count:8},argTypes:{count:{control:{min:0,max:4,step:2}}}};
      export const Saved = {args:{count:6}};
      export const Valid = {args:{count:2}};`,
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
      built.stderr.match(/outside its control bounds/g)?.length,
      3,
      built.stderr,
    );
    assert.match(built.stderr, /component "count"/);
    assert.match(built.stderr, /component "story\/Saved"/);
    assert.ok(!built.stderr.includes('"count/valid"'));
    assert.ok(!built.stderr.includes('"story/Valid"'));
    const indexPath = path.join(root, "mokly-static/mokly-viewer/index.json");
    const previous = await fs.readFile(indexPath);
    assert.doesNotThrow(() =>
      readCatalogueIndex(JSON.parse(previous.toString())),
    );
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
    assert.deepEqual(await fs.readFile(indexPath), previous);
  },
);
