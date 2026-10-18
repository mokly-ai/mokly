import assert from "node:assert/strict";
import test from "node:test";

import { consumer } from "./helpers/mokly_serve.js";
import { files } from "./helpers/static_faults.js";
import { command } from "./helpers/static_publication.js";
import { timings } from "./helpers/static_timings.js";

test(
  "build forwards sidecar timings with separate identities and unchanged output",
  { timeout: 120_000 },
  async (context) => {
    const root = await consumer(context, {
      "mokly.config.json": JSON.stringify({
        postcss: "postcss.mjs",
        stylesheets: [{ match: "**", stylesheets: ["theme.css"] }],
      }),
      "postcss.mjs": "export default {plugins:[]};",
      "theme.css": ".subject {color: red}",
      "specs/item.mockup.ts": `import React from 'react'; import {defineScreen,defineComponent,definePage} from '@mokly/mokly';
console.error('ordinary sidecar diagnostic');
export const screen=defineScreen({path:'screen',title:'Screen',description:'',relatedDocs:[],render:()=>{process.stderr.write('partial-sidecar-progress\\r');return React.createElement('p',{className:'subject'},'Screen')}});
export const component=defineComponent({path:'component',title:'Component',description:'',relatedDocs:[],propSchema:{type:'object',additionalProperties:false,properties:{}},render:()=>React.createElement('b',null,'Component')});
export const page=definePage({path:'page',title:'Page',description:'',relatedDocs:[],render:()=>'<!doctype html><html><head></head><body>Page</body></html>'});`,
    });
    let previous: Map<string, Buffer> | undefined;
    for (const enabled of [false, true]) {
      const result = await command(
        root,
        "build",
        [
          "--no-changes",
          "--sidecars=1",
          "--out=.context/site",
          ...(enabled ? ["--debug-timings"] : []),
        ],
        "plain",
        {},
        context.signal,
      ).result;
      assert.equal(result.code, 0, result.stderr);
      assert.match(result.stderr, /ordinary sidecar diagnostic/u);
      const output = await files(`${root}/.context/site`);
      if (previous) assert.deepEqual(output, previous);
      previous = output;
      if (!enabled) {
        assert.ok(!result.stderr.includes("[mokly:timing]"));
        continue;
      }
      const records = timings(result.stderr);
      assert.ok(result.stderr.includes("partial-sidecar-progress\\u000d\n"));
      const core = records.filter((record) => record.role === "core");
      const sidecar = records.filter((record) => record.role === "sidecar");
      assert.ok(sidecar.length > 0);
      const spawned = core.filter((record) => record.stage === "sidecar.spawn");
      assert.equal(spawned.length, 2);
      assert.equal(spawned[1]!.status, "ok");
      assert.ok(core.some((record) => record.stage === "sidecar.operation"));
      for (const stage of [
        "sidecar.bundle",
        "sidecar.describe",
        "sidecar.render",
        "sidecar.process-css",
      ]) {
        const selected = sidecar.filter((record) => record.stage === stage);
        assert.ok(
          selected.some((record) => record.event === "start"),
          stage,
        );
        assert.ok(
          selected.some(
            (record) => record.event === "end" && record.status === "ok",
          ),
          stage,
        );
      }
      const starts = new Map(
        sidecar
          .filter((record) => record.event === "start")
          .map((record) => [record.id, record]),
      );
      for (const record of sidecar) {
        assert.notEqual(record.pid, core[0]!.pid);
        assert.notEqual(record.session, core[0]!.session);
        assert.equal(record.pid, sidecar[0]!.pid);
        assert.equal(record.session, sidecar[0]!.session);
        assert.ok(!JSON.stringify(record).includes(root));
        if (record.event === "end")
          assert.equal(record.stage, starts.get(record.id)!.stage);
      }
      assert.deepEqual(
        new Set(
          sidecar
            .filter((record) => record.stage === "sidecar.render")
            .map((record) => record.kind),
        ),
        new Set(["screen", "component", "page"]),
      );
    }
  },
);

test(
  "failed sidecar work ends its timing span with error and keeps authored text out of records",
  { timeout: 120_000 },
  async (context) => {
    const root = await consumer(context, {
      "specs/page.mockup.ts":
        "import {definePage} from '@mokly/mokly'; export default definePage({title:'Page',description:'',relatedDocs:[],render(){throw new Error('authored-only-failure')}});",
    });
    const result = await command(
      root,
      "build",
      [
        "--no-changes",
        "--sidecars=1",
        "--out=.context/site",
        "--debug-timings",
      ],
      "plain",
      {},
      context.signal,
    ).result;
    assert.equal(result.code, 1);
    assert.match(result.stderr, /authored-only-failure/u);
    const records = timings(result.stderr).filter(
      (record) => record.role === "sidecar",
    );
    assert.ok(
      records.some(
        (record) =>
          record.stage === "sidecar.render" &&
          record.event === "end" &&
          record.status === "error",
      ),
    );
    assert.ok(!JSON.stringify(records).includes("authored-only-failure"));
    assert.ok(!JSON.stringify(records).includes(root));
  },
);

test(
  "forwarded record-shaped consumer lines redact secrets and terminal controls",
  { timeout: 120_000 },
  async (context) => {
    const spoof =
      '[mokly:timing] {\r"schemaVersion":1,"role":"sidecar","session":"private/token\u007f\u0085","pid":123,"id":1,"stage":"sidecar.bundle","event":"start","elapsedMs":0,"encoded":"private%2Ftoken"}';
    const root = await consumer(context, {
      "specs/page.mockup.ts": `import {definePage} from '@mokly/mokly'; process.stderr.write(${JSON.stringify(spoof + "\n")}); export default definePage({title:'Page',description:'',relatedDocs:[],render:()=>'<!doctype html><html><head></head><body>Page</body></html>'});`,
    });
    const result = await command(
      root,
      "build",
      [
        "--no-changes",
        "--debug-timings",
        "--sidecars=1",
        "--out=.context/site",
      ],
      "plain",
      { MOKLY_TOKEN: "private/token" },
      context.signal,
    ).result;
    assert.equal(result.code, 0, result.stderr);
    assert.ok(!result.stderr.includes("private/token"));
    assert.ok(!result.stderr.includes("private%2Ftoken"));
    for (const control of ["\r", "\u007f", "\u0085"])
      assert.ok(!result.stderr.includes(control));
    assert.ok(result.stderr.includes('"session":"[redacted]\\u007f\\u0085"'));
    assert.ok(result.stderr.includes('"encoded":"[redacted]"'));
    assert.ok(result.stderr.includes("[mokly:timing] {\\u000d"));
  },
);
