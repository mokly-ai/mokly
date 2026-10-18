import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { completed, consumer, serve, shim } from "./helpers/mokly_serve.js";

const component = `import React from 'react'; import {defineComponent,defineScreen} from '@mokly/mokly';
let renders=0;
export const card=defineComponent({path:'card',element:'ui-card',title:'Card',description:'',relatedDocs:[],
propSchema:{type:'object',additionalProperties:false,properties:{label:{type:'string'},count:{type:'integer'}},required:['label','count']},
props:{label:'Saved',count:2},slots:['children'],controls:{label:{kind:'text',maxLength:5},count:{kind:'number',minimum:0,maximum:4,step:2}},
render:(props)=>React.createElement('button',{'data-render':++renders},props.label+':'+props.count,props.children)});
export const home=defineScreen({path:'home',title:'Home',description:'',relatedDocs:[],props:{label:'Saved'},
render:(props)=>React.createElement(card.Component,{label:props.label,count:2},React.createElement('em',null,'React slot'))});`;

test(
  "Serve renders JavaScript live props with the shared renderer, CSS, token, and revision fence",
  { timeout: 60_000 },
  async (context) => {
    const root = await consumer(context, {
      "mokly.config.json": JSON.stringify({
        renderer: "renderer.mjs",
        postcss: "postcss.mjs",
        stylesheets: [{ match: "**", stylesheets: ["style.css"] }],
      }),
      "specs/entries.mockup.ts": component,
      "specs/html.screen.html":
        '---\ntitle: HTML\n---\n<ui-card label="HTML" count="2"><b>HTML slot</b></ui-card>',
      "renderer.mjs":
        "import React from 'react'; export default ({node})=>React.createElement('section',{'data-provider':'consumer'},node);",
      "postcss.mjs":
        "export default {plugins:[{postcssPlugin:'colors',Declaration(decl){if(decl.value==='MOKLY_COLOR') decl.value='blue'}}]};",
      "style.css": "button { color: MOKLY_COLOR }",
    });
    const running = serve(context, root);
    const url = await running.ready();
    const { index, detail } = await completed(url, running.signal, "card");
    assert.equal(index.changesStatus, "unavailable");
    assert.ok(
      detail.workspace.usedBy.some(
        (use: { entryPath: string }) => use.entryPath === "home",
      ),
    );
    assert.ok(
      detail.workspace.usedBy.some(
        (use: { entryPath: string }) => use.entryPath === "html",
      ),
    );
    for (const route of ["home", "html"]) {
      const bytes = await (
        await fetch(
          `${url}/static/mokly-generated/${route}/index.mobile.html`,
          { signal: running.signal },
        )
      ).text();
      const slots = [...bytes.matchAll(/<!--mokly-slot:start ([^>]+)-->/g)];
      assert.ok(slots.length > 0, bytes);
      for (const slot of slots) {
        const receiver = /instance="(r-\d+)"/.exec(slot[1]!);
        assert.ok(receiver, slot[0]);
        assert.ok(
          bytes.includes(`<!--mokly-instance:start id="${receiver[1]}"`),
          slot[0],
        );
      }
    }
    const savedUrl = `${url}/static/mokly-generated/card/index.mobile.html`;
    const saved = await (
      await fetch(savedUrl, { signal: running.signal })
    ).text();
    assert.match(saved, /Saved:2/);
    assert.match(saved, /data-provider="consumer"/);
    const live = await (
      await fetch(`${url}/mokly-viewer/live.json`, { signal: running.signal })
    ).json();
    const body = {
      entryPath: "card",
      viewport: "mobile",
      colorScheme: "light",
      revision: index.revision,
      pageId: "a".repeat(32),
      overrides: {
        label: { kind: "set", value: "Edit" },
        count: { kind: "set", value: 4 },
      },
    };
    const render = (
      input: unknown = body,
      token = live.render.token,
      origin = url,
    ) =>
      fetch(`${url}${live.render.url}`, {
        method: "POST",
        signal: running.signal,
        headers: {
          "content-type": "application/json",
          origin,
          "x-mokly-render-token": token,
        },
        body: JSON.stringify(input),
      });
    assert.equal((await render(body, "wrong")).status, 403);
    assert.equal(
      (await render(body, live.render.token, "http://example.invalid")).status,
      403,
    );
    const stale = await render({ ...body, revision: body.revision - 1 });
    assert.equal(stale.status, 409);
    assert.equal((await stale.json()).code, "stale-revision");
    for (const overrides of [
      {
        label: { kind: "set", value: "Too long" },
        count: { kind: "set", value: 2 },
      },
      {
        label: { kind: "set", value: "Edit" },
        count: { kind: "set", value: 3 },
      },
      { label: { kind: "unset" }, count: { kind: "set", value: 2 } },
    ])
      assert.equal((await render({ ...body, overrides })).status, 400);
    const response = await render();
    assert.equal(response.status, 200, await response.clone().text());
    const preview = await response.json();
    assert.equal(preview.revision, index.revision);
    assert.equal(preview.usage.status, "ready");
    const html = await (
      await fetch(`${url}${preview.previewUrl}`, { signal: running.signal })
    ).text();
    assert.match(html, /Edit:4/);
    assert.match(html, /data-provider="consumer"/);
    const stylesheet = html.match(/<link[^>]*href="([^"]+)"/);
    assert.ok(stylesheet, html);
    const css = await fetch(
      new URL(stylesheet[1]!, `${url}${preview.previewUrl}`),
      { signal: running.signal },
    );
    assert.equal(css.status, 200);
    assert.match(await css.text(), /blue|#00f/);
    const repeat = await (await render()).json();
    assert.equal(
      await (
        await fetch(`${url}${repeat.previewUrl}`, { signal: running.signal })
      ).text(),
      html,
    );
    assert.equal(
      await (await fetch(savedUrl, { signal: running.signal })).text(),
      saved,
    );
    const after = await (
      await fetch(`${url}/mokly-viewer/index.json`, { signal: running.signal })
    ).json();
    assert.deepEqual(after, index);
    await running.close();
    assert.match(running.output.stderr, /^\[mokly\/git-failed\] [^\n]+\n$/);
  },
);

test(
  "renderer-only catalogues inventory imported source in Serve and build",
  { timeout: 60_000 },
  async (context) => {
    const root = await consumer(context, {
      "mokly.config.json": '{"renderer":"renderer.mjs"}',
      "renderer.mjs": "import './helper.js'; export default ({node})=>node;",
      "helper.js": "export const secret='private source';",
      "specs/home.screen.html":
        '---\ntitle: Home\n---\n<a href="../../helper.js">Helper</a>',
    });
    const built = spawnSync(process.execPath, [shim, "build", "--no-changes"], {
      cwd: root,
      encoding: "utf8",
      env: { ...process.env, MOKLY_OUTPUT: "plain" },
    });
    assert.equal(built.status, 1);
    assert.match(built.stderr, /protected target .*helper\.js/);
    assert.doesNotMatch(built.stderr, /JavaScript renderer is unavailable/);
    const running = serve(context, root);
    const url = await running.ready();
    assert.equal(
      (await fetch(`${url}/static/helper.js`, { signal: running.signal }))
        .status,
      404,
    );
    const rendered = await fetch(
      `${url}/static/mokly-generated/home/index.mobile.html`,
      { signal: running.signal },
    );
    assert.equal(rendered.status, 500);
    await running.wait("stderr", /protected target .*helper\.js/);
    await running.close();
    assert.equal(
      await fs.readFile(path.join(root, "helper.js"), "utf8"),
      "export const secret='private source';",
    );
  },
);
