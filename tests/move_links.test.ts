import assert from "node:assert/strict";
import test from "node:test";

import {
  componentRuntime,
  runtimeGraph,
} from "../dist/build/component_runtime.js";
import { DocumentCompiler } from "../dist/build/document_compiler.js";
import { compareReview } from "../dist/review/compare.js";
import { ComponentRenderService } from "../dist/server/controls/service.js";

import { componentReviewFixture } from "./helpers/component_review_fixture.js";
import { pageSource, pathFixture } from "./helpers/path_fixture.js";

for (const hint of [false, true])
  test(`initial builds diagnose only authored move hints: hint=${hint}`, async (t) => {
    const fixture = await pathFixture({
      "specs/linker.mockup.ts": pageSource(
        "",
        '<html><body><a href="mock:old">Open</a></body></html>',
      ),
      "specs/current.mockup.ts": pageSource(hint ? 'movedFrom:"old",' : ""),
    });
    t.after(fixture.remove);
    await assert.rejects(fixture.compile(), {
      code: "build-invalid",
      detail: `[${hint ? "moved-link-target" : "unknown-link-target"}] specs/linker.mockup.ts export default: link target old does not exist${hint ? "; it moved to current" : ""}`,
    });
  });

test("Markdown movedFrom hints use the same build diagnostic", async (t) => {
  const fixture = await pathFixture({
    "specs/current.md": "---\nmovedFrom: old\n---\n# Current",
    "specs/linker.md": "# Links\n\n[Open](mock:old)",
  });
  t.after(fixture.remove);
  await assert.rejects(fixture.compile(), {
    code: "build-invalid",
    detail:
      "[moved-link-target] specs/linker.md: link target old does not exist; it moved to current",
  });
});

test("later controlled renders use accepted pairs from their own generation", async (t) => {
  const source = `import {definePage,defineComponent} from '@mokly/mokly';
    export const target = definePage({path:'old',title:'Target',description:'A target',dependencies:[],relatedDocs:[],render:()=>'<html><body>Target</body></html>'});
    export const linker = defineComponent({path:'linker',title:'Linker',description:'A link',dependencies:[],relatedDocs:[],propSchema:{kind:'object',properties:{target:{schema:{kind:'string'}}}},controls:{target:{kind:'text',label:'Destination',maxLength:100}},render:(props)=><a href={'mock:'+props.target}>Target</a>,variants:[{slug:'saved',title:'Saved',props:{target:'old'}}]});`;
  const fixture = await componentReviewFixture(
    t,
    (text) => text.replaceAll("'old'", "'current'"),
    source,
  );
  const artifact = await compareReview(
    fixture.after,
    fixture.config,
    fixture.git,
    "main",
  );
  const moves = artifact.pairing!.moves;
  assert.deepEqual(moves, [
    { kind: "page", path: "current", previousPath: "old" },
  ]);
  const runtime = componentRuntime(fixture.after);
  const compiler = new DocumentCompiler(runtime, runtimeGraph(runtime));
  const location = compiler.entries.find(
    (entry) => entry.path === "linker/saved",
  )!.location;
  const prefix = `${location}: link target old does not exist`;
  const route = "linker/saved/index.desktop.html";
  assert.throws(() => compiler.render(route, { target: "old" }), {
    detail: `[unknown-link-target] ${prefix}`,
  });
  assert.throws(
    () =>
      compiler.render(
        route,
        { target: "old" },
        { generation: runtime.generation, moves },
      ),
    { detail: `[moved-link-target] ${prefix}; it moved to current` },
  );
  assert.throws(() => compiler.render(route, { target: "old" }), {
    detail: `[unknown-link-target] ${prefix}`,
  });
  assert.throws(
    () =>
      compiler.render(
        route,
        { target: "old" },
        { generation: "another-generation", moves },
      ),
    { detail: "Move evidence belongs to another render generation" },
  );
  const service = new ComponentRenderService(runtime, (generation) => ({
    generation,
    moves,
  }));
  fixture.beforeRemove(() => service.close());
  await assert.rejects(
    service.render(
      {
        componentId: "linker",
        variantPath: "linker/saved",
        viewport: "desktop",
        colorScheme: "light",
        generation: runtime.generation,
        pageId: "a".repeat(32),
        overrides: { target: { kind: "set", value: ["string", "old"] } },
      },
      new AbortController().signal,
    ),
    {
      code: "render-failed",
      detail: `[mokly/build-invalid] [moved-link-target] ${prefix}; it moved to current`,
    },
  );
});
