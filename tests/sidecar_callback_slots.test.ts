import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import {
  callbackConsumer,
  callbackEntry,
  callbackPrelude,
} from "./helpers/sidecar_callbacks.js";
import { build } from "./helpers/static_changes.js";
import { command } from "./helpers/static_publication.js";

const source = (impure: boolean) => `
export const leaf = defineComponent({...metadata,path:'leaf',title:'Leaf',
  propSchema:{type:'object',additionalProperties:false,required:['label'],properties:{label:{type:'string'}}},
  props:{label:'Own'},render:props=><b>{props.label}</b>});
export const pane = defineComponent({...metadata,path:'pane',title:'Pane',
  propSchema:{type:'object',additionalProperties:false,properties:{}},slots:['children'],
  render:props=><section>{props.children}{props.children}</section>});
let calls=0;
function Vary(){return <leaf.Component label={${impure ? "String(++calls)" : "'Stable'"}}/>;}
export const screen = defineScreen({...metadata,path:'screen',title:'Screen',
  render:()=> <pane.Component><Vary/></pane.Component>});
`;

test(
  "repeated React slots reject conflicting inputs from an impure child and retain pure replay",
  { timeout: 120_000 },
  async (context) => {
    const root = await callbackConsumer(context, source(true));
    const rejected = await command(
      root,
      "build",
      ["--no-changes", "--sidecars=1", "--out=.context/site"],
      "plain",
      {},
      context.signal,
    ).result;
    assert.equal(rejected.code, 1, rejected.stderr);
    assert.match(rejected.stderr, /conflicting fragment input [a-f0-9]{64}/u);
    await assert.rejects(fs.access(path.join(root, ".context/site")), {
      code: "ENOENT",
    });

    await fs.writeFile(
      path.join(root, callbackEntry),
      callbackPrelude + source(false),
    );
    const ready = await build(
      root,
      ["--no-changes", "--sidecars=1", "--strict"],
      "plain",
      context.signal,
    );
    for (const viewport of ["mobile", "desktop"])
      for (const scheme of ["", ".dark"]) {
        const html = await fs.readFile(
          path.join(
            ready.output,
            `static/mokly-generated/screen/index.${viewport}${scheme}.html`,
          ),
          "utf8",
        );
        assert.equal(html.match(/<b>Stable<\/b>/gu)?.length, 2);
      }
  },
);
