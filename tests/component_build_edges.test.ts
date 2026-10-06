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
    extra: `const chain = defineComponent({ ...metadata, path: "chain", title: "Chain", description: "Nested ownership", propSchema: { kind: "object", properties: { depth: { schema: { kind: "number", integer: true, minimum: 0, maximum: 32 } } } }, render: (props) => props.depth ? <div><chain.Component depth={props.depth - 1} /></div> : <action.Component label="Leaf" />, variants: [{ slug: "default",  title: "Default", props: { depth: 32 } }] });`,
    exports: "...action.entries, ...pane.entries, ...chain.entries,",
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

test("saved variants share transactional orphan protection", async (t) => {
  const source = componentEntrySource();
  const fixture = await createFixture(source, {
    extraConfig: 'colorSchemes: ["light", "dark"],',
  });
  t.after(() => removeFixture(fixture));
  const config = await loadConfig(fixture.root);
  const first = await compileCatalogue(config);
  await writeCompilation(first, config);
  const oldRoute = "action/disabled/index.desktop.dark.html";
  assert.ok(first.outputs.has(oldRoute));
  await fs.writeFile(
    fixture.entryPath,
    source.replace(
      ', { slug: "disabled", title: "Disabled", props: { label: "Continue", disabled: true } }',
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
});

test("compatibility rejects removed component ownership", async (t) => {
  const fixture = await createFixture(componentEntrySource(), {
    extraConfig:
      'compatibility: { transformer: "transform.ts" }, renderer: "renderer.tsx",',
  });
  t.after(() => removeFixture(fixture));
  await fs.writeFile(
    path.join(fixture.root, "transform.ts"),
    'export default ({ content }) => content.replace(/<!--mokly-component:[\\s\\S]*?-->/g, "");',
  );
  await fs.writeFile(
    path.join(fixture.root, "renderer.tsx"),
    `import { renderToStaticMarkup } from "react-dom/server"; export default (input) => '<html><head><style>.owned{color:red}</style></head><body>' + renderToStaticMarkup(input.node) + '</body></html>';`,
  );
  await assert.rejects(
    compileCatalogue(await loadConfig(fixture.root)),
    /component boundar/,
  );
});

test("compatibility may edit head styles before inferred comparison", async (t) => {
  const fixture = await createFixture(componentEntrySource(), {
    extraConfig:
      'compatibility: { transformer: "transform.ts" }, renderer: "renderer.tsx",',
  });
  t.after(() => removeFixture(fixture));
  await fs.writeFile(
    path.join(fixture.root, "transform.ts"),
    'export default ({ content }) => content.replace(".owned{color:red}", ".owned{color:blue}");',
  );
  await fs.writeFile(
    path.join(fixture.root, "renderer.tsx"),
    `import { renderToStaticMarkup } from "react-dom/server"; export default (input) => '<html><head><style>.owned{color:red}</style></head><body>' + renderToStaticMarkup(input.node) + '</body></html>';`,
  );
  const result = await compileCatalogue(await loadConfig(fixture.root));
  assert.ok(
    [...result.outputs.values()].some(
      (html) => typeof html === "string" && html.includes(".owned{color:blue}"),
    ),
  );
});

test("an actually invoked wrapper must be exported", async (t) => {
  const source = componentEntrySource({ exports: "...pane.entries," });
  const fixture = await createFixture(source);
  t.after(() => removeFixture(fixture));
  await assert.rejects(
    compileCatalogue(await loadConfig(fixture.root)),
    /component definition is not exported in the registry/,
  );
});
