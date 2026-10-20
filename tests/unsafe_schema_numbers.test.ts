import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { readCatalogueIndex } from "../packages/viewer/src/catalogue/index_reader.js";
import { decodeProps } from "../packages/viewer/src/components/codec.js";

import { consumer } from "./helpers/mokly_serve.js";
import { command } from "./helpers/static_publication.js";

for (const [name, schema] of [
  ["minimum", "{type: integer, minimum: 9007199254740993}"],
  ["maximum", "{type: integer, maximum: -9007199254740993}"],
  ["multipleOf", "{type: integer, multipleOf: 9007199254740993}"],
  ["enum", "{enum: [9007199254740993]}"],
  ["const", "{const: 9007199254740993}"],
  ["oneOf", "{oneOf: [{const: 9007199254740993, title: Large}]}"],
]) {
  test(
    `unsafe ${name} and matching saved props round before validation and coercion`,
    { timeout: 120_000 },
    async (context) => {
      const negative = name === "maximum";
      const authored = negative ? "-9007199254740993" : "9007199254740993";
      const rounded = negative ? -9007199254740992 : 9007199254740992;
      const root = await consumer(context, {
        "specs/number.component.html": `---
title: Number
element: ui-number
propSchema: {type: object, additionalProperties: false, properties: {count: ${schema}}}
props: {count: ${authored}}
---
<p>{{count}}</p>`,
        "specs/home.screen.html": `---
title: Home
---
<ui-number count='${rounded}'></ui-number>`,
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
      assert.match(result.stderr, /schema keyword "\/properties\/count\//);
      const indexPath = path.join(root, "mokly-static/mokly-viewer/index.json");
      const previous = await fs.readFile(indexPath);
      const index = readCatalogueIndex(JSON.parse(previous.toString()));
      assert.equal(decodeProps(index.components[0]!.props).count, rounded);
      for (const entry of ["home", "number"]) {
        const html = await fs.readFile(
          path.join(
            root,
            `mokly-static/static/mokly-generated/${entry}/index.mobile.html`,
          ),
          "utf8",
        );
        assert.ok(html.includes(`<p>${rounded}</p>`), html);
      }
      const strict = await command(
        root,
        "build",
        ["--no-changes", "--strict"],
        "plain",
        {},
        context.signal,
      ).result;
      assert.equal(strict.code, 1, strict.stderr);
      assert.match(strict.stderr, /build warnings with --strict/);
      assert.deepEqual(await fs.readFile(indexPath), previous);
    },
  );
}

test(
  "JavaScript schema numbers retain binary64 identity across JSON transport",
  { timeout: 120_000 },
  async (context) => {
    const root = await consumer(context, {
      "specs/number.mockup.ts": `import React from 'react';
import {defineScreen} from '@mokly/mokly';
const count=1000000000000000100;
export default defineScreen({title:'Number',description:'',relatedDocs:[],
  propSchema:{type:'object',additionalProperties:false,properties:{count:{const:count}}},
  props:{count},render:({count})=>React.createElement('p',null,count)});`,
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
    assert.match(result.stderr, /schema keyword "\/properties\/count\/const"/);
    const index = readCatalogueIndex(
      JSON.parse(
        await fs.readFile(
          path.join(root, "mokly-static/mokly-viewer/index.json"),
          "utf8",
        ),
      ),
    );
    assert.equal(
      decodeProps(index.screens[0]!.props).count,
      1000000000000000100,
    );
  },
);
