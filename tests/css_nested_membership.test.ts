import assert from "node:assert/strict";
import test from "node:test";

import {
  changedEntries,
  cssMembershipFixture,
  membershipSource,
} from "./helpers/css_membership_fixture.js";

const metadata = 'title: "Example", description: "Example", relatedDocs: [],';
function component(id: string, render: string, props = "{}", schema = "{}") {
  return `const ${id} = defineComponent({ path: "${id}", ${metadata} propSchema: {kind: "object", properties: ${schema}}, render: ${render}, variants: [{slug: "default", title: "Default", props: ${props}}] });`;
}
function nestedSource(definitions: string, ids: string[], node: string) {
  return `import React from "react"; import { defineComponent, defineScreen } from "@mokly/mokly";
${definitions}
export const mockups = [${ids.map((id) => `...${id}.entries`).join(",")}, defineScreen({ path: "checkout", ${metadata} mobile: ${node}, desktop: ${node} })];`;
}

test("Icon alone keeps its own-page matches inside Action inside Toolbar", async (t) => {
  const source = nestedSource(
    [
      component("icon", '() => <i className="icon">Icon</i>'),
      component("action", "() => <button><icon.Component /></button>"),
      component("toolbar", "() => <div><action.Component /></div>"),
    ].join("\n"),
    ["icon", "action", "toolbar"],
    "<toolbar.Component />",
  );
  const { result } = await cssMembershipFixture(t, {
    source,
    before: ".icon{color:red}",
    after: ".icon{color:blue}",
  });
  assert.deepEqual(changedEntries(result), ["icon", "icon/default"]);
  assert.deepEqual(
    result.affectedConsumers.map((item) => item.consumer.path).sort(),
    ["action", "checkout", "toolbar"],
  );
});

test("Y takes X's nested match using unfiltered own-page proof even when Z takes every Y match", async (t) => {
  const source = nestedSource(
    [
      component("z", '() => <i className="target">Z</i>'),
      component(
        "y",
        '(props) => props.outer ? <b className="target">Y</b> : <z.Component />',
        "{outer:false}",
        '{outer:{schema:{kind:"boolean"}}}',
      ),
      component("x", "() => <y.Component outer />"),
    ].join("\n"),
    ["z", "y", "x"],
    "<x.Component />",
  );
  const { result } = await cssMembershipFixture(t, {
    source,
    before: ".target{color:red}",
    after: ".target{color:blue}",
  });
  assert.deepEqual(changedEntries(result), [
    "checkout",
    "x/default",
    "z",
    "z/default",
  ]);
  assert.ok(
    result.affectedConsumers.every((item) => item.changedComponentId === "z"),
  );
  const page = result.changes.find(
    (entry) => entry.after?.path === "x/default",
  )!;
  assert.deepEqual(page.reasons[0]!.kind, "dependency");
});

test("self-nested roots keep their own matches", async (t) => {
  const source = nestedSource(
    component(
      "self",
      '(props) => props.leaf ? <b className="target">Leaf</b> : <self.Component leaf />',
      "{leaf:false}",
      '{leaf:{schema:{kind:"boolean"}}}',
    ),
    ["self"],
    "<self.Component leaf={false} />",
  );
  const { result } = await cssMembershipFixture(t, {
    source,
    before: ".target{color:red}",
    after: ".target{color:blue}",
  });
  assert.deepEqual(changedEntries(result), ["self", "self/default"]);
});

test("mutual nesting uses unfiltered matches without evaluation order", async (t) => {
  const source = nestedSource(
    [
      component(
        "x",
        '(props) => props.leaf ? <b className="target">X</b> : <y.Component leaf />',
        "{leaf:false}",
        '{leaf:{schema:{kind:"boolean"}}}',
      ),
      component(
        "y",
        '(props) => props.leaf ? <b className="target">Y</b> : <x.Component leaf />',
        "{leaf:false}",
        '{leaf:{schema:{kind:"boolean"}}}',
      ),
    ].join("\n"),
    ["x", "y"],
    "<x.Component leaf={false} />",
  );
  const { result } = await cssMembershipFixture(t, {
    source,
    before: ".target{color:red}",
    after: ".target{color:blue}",
  });
  assert.deepEqual(changedEntries(result), [
    "checkout",
    "x/default",
    "y/default",
  ]);
  assert.deepEqual(result.affectedConsumers, []);
});

test("mixed rules preserve independent page selectors and component reasons on one path", async (t) => {
  const { result } = await cssMembershipFixture(t, {
    before: ".action{color:red}.heading{color:red}.unknown{--tone:red}",
    after: ".action{color:blue}.heading{color:blue}.unknown{--tone:blue}",
  });
  assert.deepEqual(changedEntries(result), [
    "action",
    "action/default",
    "checkout",
    "toolbar/default",
  ]);
  const parent = result.changes.find(
    (entry) => entry.after?.path === "action",
  )!;
  assert.deepEqual(
    parent.reasons.flatMap((reason) =>
      reason.kind === "dependency" ? reason.analysis!.selectors : [],
    ),
    [".action"],
  );
  const screen = result.screens[0]!.views[0]!;
  assert.deepEqual(screen.reasons![0]!.analysis!.pageEvidence, {
    selectors: [".heading"],
    unresolved: true,
  });
});

test("parser-inserted tbody elements have no proven root containment", async (t) => {
  const source = membershipSource.replace(
    '<button className="action">Continue</button>',
    '<table className="action"><tr><td>Continue</td></tr></table>',
  );
  const { result } = await cssMembershipFixture(t, {
    source,
    before: ".action tbody{color:red}",
    after: ".action tbody{color:blue}",
  });
  assert.deepEqual(changedEntries(result), [
    "action/default",
    "checkout",
    "toolbar/default",
  ]);
  assert.deepEqual(result.affectedConsumers, []);
});
