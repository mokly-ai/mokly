import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { compileCatalogue } from "../dist/build/compile.js";
import { runtimeGraph } from "../dist/build/component_runtime.js";
import { DocumentCompiler } from "../dist/build/document_compiler.js";
import { prepareLiveRuntime } from "../dist/build/live_runtime.js";
import { validateComponentRanges } from "../dist/components/ranges.js";
import { loadConfig } from "../dist/config/load.js";
import { startCatalogueServer } from "../dist/server/http.js";

import { componentEntrySource } from "./helpers/component_fixture.js";
import { createFixture, removeFixture } from "./helpers/fixture.js";

const css = '.owned::before{content:"😀 café"}';
for (const pipeline of ["Build", "demand Serve"] as const) {
  test(`${pipeline} keeps body style ownership through head insertion and logical edits`, async (t) => {
    const fixture = await createFixture(
      componentEntrySource({
        body: '<ReviewIgnore id="stamp"><span>Transient</span></ReviewIgnore><pane.Component><span>Slot</span></pane.Component><action.Component label="Owned"/><MockLink asChild to="action"><button>Continue</button></MockLink>',
      }),
      { extraConfig: 'renderer: "renderer.tsx",' },
    );
    t.after(() => removeFixture(fixture));
    await fs.writeFile(
      path.join(fixture.root, "renderer.tsx"),
      `import {renderToStaticMarkup} from "react-dom/server";
export default input => {
 const css = ${JSON.stringify(css)};
 const body = renderToStaticMarkup(input.node);
 const html = '<!doctype html><html><head><style>'+css+'</style></head><body>😀<a href="mock:action">Before</a>'+body+'<style data-owner="action">'+css+'</style><a href="mock:pane">Between</a><style data-owner="pane">'+css+'</style></body></html>';
 return {html, styles: input.entry.path === "home" ? ["action","pane"].map(id => {
  const startOffset=html.indexOf('<style data-owner="'+id+'">')+('<style data-owner="'+id+'">').length;
  return {startOffset,endOffset:startOffset+css.length,componentIds:[id]};
 }) : []};
};`,
    );
    const config = await loadConfig(fixture.root);
    const route = "home/index.mobile.html";
    let html: string;
    let styles;
    if (pipeline === "Build") {
      const compiled = await compileCatalogue(config);
      html = String(compiled.outputs.get(route));
      const screen = compiled.manifest.entries.find(
        (entry) => entry.kind === "screen",
      );
      assert.ok(screen?.kind === "screen");
      styles = screen.componentViews!.find(
        (view) => view.viewport === "mobile",
      )!.styles;
      validateComponentRanges(html, screen.componentViews![0]!.ranges);
    } else {
      const runtime = await prepareLiveRuntime(config);
      const rendered = new DocumentCompiler(
        runtime,
        runtimeGraph(runtime),
      ).render(route);
      html = rendered.html;
      styles = rendered.view!.styles;
      validateComponentRanges(html, rendered.view!.ranges);
      const server = await startCatalogueServer(config, {
        base: "HEAD",
        port: 0,
        componentRuntime: runtime,
      });
      fixture.beforeRemove(() => server.close());
      const response = await fetch(
        server.url + "/static/mokly-generated/" + route,
      );
      assert.equal(response.status, 200);
      assert.match(await response.text(), /data-mokly-link="action"/);
    }
    assert.equal(styles.length, 2);
    for (const [index, id] of ["action", "pane"].entries()) {
      const opening = `<style data-owner="${id}">`;
      assert.equal(
        styles[index]!.startOffset,
        html.indexOf(opening) + opening.length,
      );
      assert.equal(
        html.slice(styles[index]!.startOffset, styles[index]!.endOffset),
        css,
      );
      assert.deepEqual(styles[index]!.componentIds, [id]);
    }
    assert.match(html, /<style data-mokly-link-control-styles="">/);
    assert.match(html, /href="\.\.\/action\/default\/index.mobile.html"/);
    assert.doesNotMatch(html, /data-mokly-link-child-|href="mock:/);
    assert.match(html, /mokly-review-ignore:start:stamp/);
    assert.equal((html.match(/😀 café/g) ?? []).length, 3);
  });
}
