import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { consumer } from "./helpers/mokly_serve.js";
import { command } from "./helpers/static_publication.js";

const suffix =
  "is outside the JavaScript safe integer range and uses the nearest binary64 value";

for (const [name, controls, expected] of [
  ["minimum", "{kind:'number',minimum:-9007199254740993}", ["/count/minimum"]],
  ["maximum", "{kind:'number',maximum:9007199254740993}", ["/count/maximum"]],
  ["step", "{kind:'number',step:9007199254740993}", ["/count/step"]],
  ["length", "{kind:'text',maxLength:9007199254740993}", ["/count/maxLength"]],
  [
    "choice",
    "{kind:'select',options:[{label:'Safe',value:0},{label:'Large',value:9007199254740993}]}",
    ["/count/options/1/value"],
  ],
] as const) {
  test(
    `unsafe control-only ${name} warns once and strict preserves installed output`,
    { timeout: 120_000 },
    async (context) => {
      const kind = name === "length" ? "string" : "integer";
      const value = name === "length" ? "''" : "0";
      const root = await consumer(context, {
        "specs/number.mockup.ts": `import React from 'react';
import {defineScreen} from '@mokly/mokly';
export default defineScreen({title:'Number',description:'',relatedDocs:[],
  propSchema:{type:'object',additionalProperties:false,properties:{count:{type:'${kind}'}}},
  props:{count:${value}},controls:{count:${controls}},
  variants:[{slug:'saved',title:'Saved',props:{}}],
  render:({count})=>React.createElement('p',null,count)});`,
      });
      const ordinary = await command(
        root,
        "build",
        ["--no-changes"],
        "plain",
        {},
        context.signal,
      ).result;
      assert.equal(ordinary.code, 0, ordinary.stderr);
      const lines = ordinary.stderr
        .split("\n")
        .filter((line) => line.includes(suffix));
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
      assert.deepEqual(
        lines,
        expected.map(
          (pointer) =>
            `[mokly/warning] entry "number": control "${pointer}" ${suffix}`,
        ),
      );
      assert.match(strict.stderr, /1 build warning with --strict/);
      assert.deepEqual(await fs.readFile(index), previous);
    },
  );
}

test(
  "unsafe story-only control hints warn on their entry without changing schema warnings",
  { timeout: 120_000 },
  async (context) => {
    const root = await consumer(context, {
      "specs/number.stories.tsx": `import React from 'react';
export default {title:'Number',component:({count})=>React.createElement('p',null,count),args:{count:0}};
export const Saved={argTypes:{count:{control:{type:'number',max:9007199254740993}}}};`,
    });
    const ordinary = await command(
      root,
      "build",
      ["--no-changes"],
      "plain",
      {},
      context.signal,
    ).result;
    assert.equal(ordinary.code, 0, ordinary.stderr);
    assert.deepEqual(
      ordinary.stderr.split("\n").filter((line) => line.includes(suffix)),
      [
        `[mokly/warning] component "number/Saved": control "/count/maximum" ${suffix}`,
      ],
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
    assert.match(strict.stderr, /1 build warning with --strict/);
  },
);

test(
  "story choice hints warn per subject and ignore unused numeric hints",
  { timeout: 120_000 },
  async (context) => {
    const root = await consumer(context, {
      "specs/number.stories.tsx": `import React from 'react';
export default {title:'Number',component:({count})=>React.createElement('p',null,count),args:{count:0},
  argTypes:{count:{options:[0,9007199254740993],control:{max:9007199254740993}},
    missing:{control:{max:9007199254740993}}}};
export const Saved={};`,
    });
    const result = await command(
      root,
      "build",
      ["--no-changes", "--strict"],
      "plain",
      {},
      context.signal,
    ).result;
    assert.equal(result.code, 1, result.stderr);
    assert.deepEqual(
      result.stderr.split("\n").filter((line) => line.includes(suffix)),
      ["number", "number/Saved"].map(
        (entry) =>
          `[mokly/warning] component "${entry}": control "/count/options/1/value" ${suffix}`,
      ),
    );
    assert.match(result.stderr, /2 build warnings with --strict/);
  },
);

test(
  "safe controls do not add unsafe-integer warnings",
  { timeout: 120_000 },
  async (context) => {
    const root = await consumer(context, {
      "specs/number.mockup.ts": `import React from 'react';
import {defineScreen} from '@mokly/mokly';
export default defineScreen({title:'Number',description:'',relatedDocs:[],
  propSchema:{type:'object',additionalProperties:false,properties:{count:{type:'integer'}}},
  props:{count:0},controls:{count:{kind:'number',minimum:-9007199254740991,maximum:9007199254740991,step:1}},
  render:({count})=>React.createElement('p',null,count)});`,
    });
    const result = await command(
      root,
      "build",
      ["--no-changes", "--strict"],
      "plain",
      {},
      context.signal,
    ).result;
    assert.equal(result.code, 0, result.stderr);
    assert.doesNotMatch(
      result.stderr,
      /props-unsafe-integer|outside the JavaScript safe integer range/,
    );
  },
);
