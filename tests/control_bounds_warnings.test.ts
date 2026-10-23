import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { readCatalogueIndex } from "../packages/viewer/src/catalogue/index_reader.js";

import { consumer } from "./helpers/mokly_serve.js";
import { command } from "./helpers/static_publication.js";

const component = (step: number, multiple = 2, count = 6) => `
import React from 'react';
import {defineComponent} from '@mokly/mokly';
export default defineComponent({path:'count',title:'Count',description:'',relatedDocs:[],
  propSchema:{type:'object',additionalProperties:false,properties:{count:{type:'integer',multipleOf:${multiple}}}},
  props:{count:${count}},controls:{count:{kind:'number',minimum:0,maximum:4,step:${step}}},
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

test(
  "declared number steps must fit integer types and schema multiples",
  { timeout: 120_000 },
  async (context) => {
    const root = await consumer(context, {});
    for (const [step, multiple, count] of [
      [3, 2, 0],
      [0.5, 1, 0],
      [6, 2, 0],
    ]) {
      await fs.mkdir(path.join(root, "specs"), { recursive: true });
      await fs.writeFile(
        path.join(root, "specs/count.mockup.ts"),
        component(step!, multiple!, count!),
      );
      const result = await command(
        root,
        "build",
        ["--no-changes"],
        "plain",
        {},
        context.signal,
      ).result;
      assert.equal(result.code, step === 6 ? 0 : 1, result.stderr);
      if (step !== 6) assert.match(result.stderr, /component-controls/);
    }
  },
);
