import assert from "node:assert/strict";
import test from "node:test";

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
  assert.equal(result.schemaVersion, 3);
  if (result.schemaVersion !== 3) return;
  const home = result.changes.find(
    (entry) => entry.after?.route === "screens/home.html",
  );
  assert.deepEqual(
    home?.reasons.map(({ kind }) => kind),
    ["inputs", "material"],
  );
  assert.ok(
    !result.changes.some(
      (entry) => entry.kind === "component" && entry.after?.id === "action",
    ),
  );
});

test("a parent implementation changing child props owns the atomic rule", async (t) => {
  const before = componentEntrySource({
    actionRender:
      "(props) => <button className={`tone-${props.label}`}>{props.label}</button>",
    extra:
      'const parent = defineComponent({ ...metadata, id: "parent", title: "Parent", description: "Parent", route: "components/parent.html", propSchema: { kind: "object", properties: {} }, render: () => <action.Component label="before" />, variants: [{ id: "default", title: "Default", props: {} }] });',
    exports: "action.entry, pane.entry, parent.entry,",
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
  assert.equal(result.schemaVersion, 3);
  if (result.schemaVersion !== 3) return;
  const routes = result.changes.map(
    (entry) => (entry.after ?? entry.before)!.route,
  );
  assert.ok(routes.includes("components/parent.html"));
  assert.ok(!routes.includes("components/action.html"));
  assert.ok(
    result.affectedConsumers.some(
      (item) => item.changedComponentId === "parent",
    ),
  );
});
