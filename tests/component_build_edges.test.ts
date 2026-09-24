import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";

import { checkCompilation } from "../dist/build/check.js";
import { compileCatalogue } from "../dist/build/compile.js";
import { writeCompilation } from "../dist/build/transaction.js";
import { loadConfig } from "../dist/config/load.js";

import { componentEntrySource } from "./helpers/component_fixture.js";
import { createFixture, removeFixture } from "./helpers/fixture.js";

test("deep recursive usage keeps fixed-size deterministic keys", async (t) => {
  const source = componentEntrySource({
    extra: `const chain = defineComponent({ ...metadata, id: "chain", title: "Chain", description: "Nested ownership", route: "components/chain.html", propSchema: { kind: "object", properties: { depth: { schema: { kind: "number", integer: true, minimum: 0, maximum: 32 } } } }, render: (props) => props.depth ? <div><chain.Component depth={props.depth - 1} /></div> : <action.Component label="Leaf" />, variants: [{ id: "default", title: "Default", props: { depth: 32 } }] });`,
    exports: "action.entry, pane.entry, chain.entry,",
    body: "<chain.Component depth={32} />",
  });
  const fixture = await createFixture(source);
  t.after(() => removeFixture(fixture));
  const config = await loadConfig(fixture.root);
  const first = await compileCatalogue(config);
  const second = await compileCatalogue(config);
  assert.deepEqual(first, second);
  const screen = first.manifest.entries.find(
    (entry) => entry.kind === "screen",
  )!;
  assert.equal(screen.componentViews![0]!.instances.length, 34);
  assert.ok(
    screen.componentViews![0]!.instances.every((instance) =>
      /^[a-f0-9]{64}$/.test(instance.key),
    ),
  );
});

test("a repeated slot rejects conflicting logical inputs from an impure child", async (t) => {
  const fixture = await createFixture(
    componentEntrySource({
      extra:
        "let count = 0; function Vary() { return <action.Component label={String(++count)} />; }",
      body: "<pane.Component><Vary /></pane.Component>",
      paneRender:
        "(props) => <section>{props.children}{props.children}</section>",
    }),
  );
  t.after(() => removeFixture(fixture));
  await assert.rejects(
    compileCatalogue(await loadConfig(fixture.root)),
    /conflicting/,
  );
});

test("saved variants share transactional collision and orphan protection", async (t) => {
  const source = componentEntrySource();
  const fixture = await createFixture(source, {
    extraConfig: 'colorSchemes: ["light", "dark"],',
  });
  t.after(() => removeFixture(fixture));
  const config = await loadConfig(fixture.root);
  const first = await compileCatalogue(config);
  await writeCompilation(first, config);
  const oldRoute = "components/action.variants/disabled.desktop.dark.html";
  assert.ok(first.outputs.has(oldRoute));
  await fs.writeFile(
    fixture.entryPath,
    source.replace(
      ', { id: "disabled", title: "Disabled", props: { label: "Continue", disabled: true } }',
      "",
    ),
  );
  const next = await compileCatalogue(config);
  assert.throws(() => checkCompilation(next, config), /orphan/);
  await writeCompilation(next, config);
  await assert.rejects(fs.stat(path.join(fixture.mockupsDir, oldRoute)), {
    code: "ENOENT",
  });
  checkCompilation(next, config);
  await fs.writeFile(
    fixture.entryPath,
    source.replace(
      'route: "screens/home.html"',
      'route: "components/action.variants/default.html"',
    ),
  );
  await assert.rejects(
    compileCatalogue(config),
    /collision|duplicate|already/i,
  );
});

for (const [name, transform, error] of [
  [
    "removed ownership",
    'content.replace(/<!--mokly-component:[\\s\\S]*?-->/g, "")',
    /component boundar/,
  ],
  [
    "changed owned head styles",
    'content.replace(".owned{color:red}", ".owned{color:blue}")',
    /preserved text/,
  ],
] as const)
  test(`compatibility rejects ${name}`, async (t) => {
    const fixture = await createFixture(componentEntrySource(), {
      extraConfig:
        'compatibility: { transformer: "transform.ts" }, renderer: "renderer.tsx",',
    });
    t.after(() => removeFixture(fixture));
    await fs.writeFile(
      path.join(fixture.root, "transform.ts"),
      `export default ({ content }) => ${transform};`,
    );
    await fs.writeFile(
      path.join(fixture.root, "renderer.tsx"),
      `import { renderToStaticMarkup } from "react-dom/server"; export default (input) => { const css = ".owned{color:red}"; const html = '<html><head><style>' + css + '</style></head><body>' + renderToStaticMarkup(input.node) + '</body></html>'; return { html, styles: [{ startOffset: html.indexOf(css), endOffset: html.indexOf(css) + css.length, componentIds: ["action"] }] }; };`,
    );
    await assert.rejects(
      compileCatalogue(await loadConfig(fixture.root)),
      error,
    );
  });

test("an actually invoked wrapper must be exported", async (t) => {
  const source = componentEntrySource({ exports: "pane.entry," });
  const fixture = await createFixture(source);
  t.after(() => removeFixture(fixture));
  await assert.rejects(
    compileCatalogue(await loadConfig(fixture.root)),
    /component action is not exported/,
  );
});
