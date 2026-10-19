import assert from "node:assert/strict";
import test from "node:test";

import type { RenderResult } from "../packages/mokly/src/generated/sidecar/RenderResult.js";

import { startSidecar } from "./helpers/sidecar.js";
import {
  callbackConsumer,
  callbackEntry,
  callbackPrelude,
  describeCallbacks,
} from "./helpers/sidecar_callbacks.js";

test(
  "a private component wrapper fails only when invoked and names its defining module",
  { timeout: 120_000 },
  async (context) => {
    const root = await callbackConsumer(
      context,
      `
import {hidden} from './hidden.source';
export const screen = defineScreen({...metadata,path:'screen',title:'Screen',props:{use:false},
  render:props=>props.use ? <hidden.Component/> : <p>Unused wrapper</p>});
`,
      {
        "specs/hidden.source.tsx":
          callbackPrelude +
          `
export const hidden = defineComponent({...metadata,title:'Hidden',
  propSchema:{type:'object',additionalProperties:false,properties:{}},render:()=> <b>Hidden</b>});
`,
      },
    );
    const sidecar = startSidecar(context, root);
    await sidecar.call("hello");
    const { generation, definitions } = await describeCallbacks(sidecar, root);
    assert.equal(definitions.screens.length, 1);
    assert.deepEqual(definitions.components, []);
    const params = {
      generation,
      handle: `${callbackEntry}#screen`,
      entry: { path: "screen", title: "Screen" },
      viewport: "mobile",
      colorScheme: "light",
    };
    const unused = await sidecar.call<RenderResult>("renderScreen", {
      ...params,
      props: { use: false },
    });
    assert.equal(unused.html, "<p>Unused wrapper</p>");
    assert.deepEqual(unused.instances, []);
    await assert.rejects(
      sidecar.call("renderScreen", { ...params, props: { use: true } }),
      {
        code: "render-failed",
        message: `${callbackEntry} export screen (mobile, light): unexported component Hidden from specs/hidden.source.tsx`,
      },
    );
    await sidecar.call("shutdown");
  },
);
