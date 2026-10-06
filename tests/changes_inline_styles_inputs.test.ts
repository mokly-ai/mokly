import assert from "node:assert/strict";
import test from "node:test";

import { compileCatalogue } from "../dist/build/compile.js";

import { componentEntrySource } from "./helpers/component_fixture.js";
import { inlineChangesFixture } from "./helpers/inline_changes.js";

const atomicRenderer = `import { renderToStaticMarkup } from "react-dom/server";
export default (input) => {
  const body = renderToStaticMarkup(input.node);
  const tone = body.includes("tone-after") ? "after" : "before";
  return '<html><head><style>.tone-' + tone + '{color:' + (tone === "after" ? "blue" : "red") + '}</style></head><body>' + body + '</body></html>';
};`;

test("a caller prop edit under atomic CSS stays with the screen inputs", async (t) => {
  const before = componentEntrySource({
    actionRender:
      "(props) => <button className={`tone-${props.label}`}>{props.label}</button>",
    body: '<action.Component label="before" />',
  });
  const after = before.replace('label="before"', 'label="after"');
  const fixture = await inlineChangesFixture(t, "", "", {
    source: before,
    afterSource: after,
    renderer: { before: atomicRenderer, after: atomicRenderer },
  });
  const { result } = await fixture.complete();
  assert.equal(result.schemaVersion, 5);
  if (result.schemaVersion !== 5) return;
  const actionIds = await actionEntryIds(fixture.config);
  const home = result.changes.find((entry) => entry.after?.path === "home");
  assert.deepEqual(
    home?.reasons.map(({ kind }) => kind),
    ["inputs", "material"],
  );
  assert.ok(
    !result.changes.some((entry) =>
      actionIds.has((entry.after ?? entry.before)!.path),
    ),
  );
});

test("a parent implementation changing child props owns the atomic rule", async (t) => {
  const before = componentEntrySource({
    actionRender:
      "(props) => <button className={`tone-${props.label}`}>{props.label}</button>",
    extra:
      'const parent = defineComponent({ ...metadata, path: "parent", title: "Parent", description: "Parent", propSchema: { kind: "object", properties: {} }, render: () => <action.Component label="before" />, variants: [{ slug: "default", title: "Default", props: {} }] });',
    exports: "...action.entries, ...pane.entries, ...parent.entries,",
    body: "<parent.Component />",
  });
  const after = before.replace(
    '<action.Component label="before" />',
    '<action.Component label="after" />',
  );
  const fixture = await inlineChangesFixture(t, "", "", {
    source: before,
    afterSource: after,
    renderer: { before: atomicRenderer, after: atomicRenderer },
  });
  const { result } = await fixture.complete();
  assert.equal(result.schemaVersion, 5);
  if (result.schemaVersion !== 5) return;
  const actionIds = await actionEntryIds(fixture.config);
  const routes = result.changes.map(
    (entry) => (entry.after ?? entry.before)!.path,
  );
  assert.ok(routes.includes("parent"));
  assert.ok(!routes.includes("action"));
  assert.ok(
    !result.changes.some((entry) =>
      actionIds.has((entry.after ?? entry.before)!.path),
    ),
  );
  assert.ok(
    result.affectedConsumers.some(
      (item) => item.changedComponentId === "parent",
    ),
  );
});

async function actionEntryIds(config: Parameters<typeof compileCatalogue>[0]) {
  const compilation = await compileCatalogue(config);
  const entries = compilation.manifest.entries.filter(
    (entry) =>
      entry.path === "action" ||
      ("variantOf" in entry && entry.variantOf === "action"),
  );
  assert.equal(entries.length, 3);
  return new Set(entries.map((entry) => entry.path));
}
