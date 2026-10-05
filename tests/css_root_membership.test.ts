import assert from "node:assert/strict";
import test from "node:test";

import { generatedViews } from "../packages/viewer/dist/data.js";

import {
  assertFastPathEquivalent,
  classifyFixtureWithSources,
} from "./helpers/component_fast_path.js";
import {
  changedEntries,
  cssMembershipFixture,
  membershipSource,
} from "./helpers/css_membership_fixture.js";

const renderer = `import {renderToStaticMarkup} from "react-dom/server";
export default (input) => '<html><head>' + input.stylesheets.map((href) => '<link rel="stylesheet" href="' + href + '">').join('') + '</head><body><div class="frame">' + renderToStaticMarkup(input.node) + '</div></body></html>';`;

test("wrapper CSS gives saved views page rows without parent changes or affected consumers", async (t) => {
  const { result } = await cssMembershipFixture(t, {
    renderer,
    before: ".frame{color:red}",
    after: ".frame{color:blue}",
  });
  assert.deepEqual(changedEntries(result), [
    "action/default",
    "checkout",
    "toolbar/default",
  ]);
  assert.deepEqual(result.affectedConsumers, []);
});

test("a selector matching both component and page elements retains the exact outside selector", async (t) => {
  const source = membershipSource.replaceAll(
    'className="heading"',
    'className="action"',
  );
  const { result } = await cssMembershipFixture(t, {
    source,
    before: ".action{color:red}",
    after: ".action{color:blue}",
  });
  assert.deepEqual(changedEntries(result), [
    "action",
    "action/default",
    "checkout",
  ]);
  assert.deepEqual(
    result.screens[0]!.views[0]!.reasons![0]!.analysis!.pageEvidence,
    { selectors: [".action"] },
  );
});

test("kept matches select only matching variants across all viewports and schemes", async (t) => {
  const source = membershipSource
    .replace(
      'properties: {} }, render: () => <button className="action">',
      'properties: {active:{schema:{kind:"boolean"}}} }, render: (props, context) => <button className={props.active && context.viewport === "desktop" && context.colorScheme === "dark" ? "action" : "other"}>',
    )
    .replace(
      'slug: "default", title: "Default", props: {}',
      'slug: "default", title: "Default", props: {active:true}}, {slug: "other", title: "Other", props: {active:false}',
    )
    .replaceAll("<action.Component />", "<action.Component active />");
  const { result } = await cssMembershipFixture(t, {
    source,
    extraConfig: 'colorSchemes: ["light", "dark"],',
    before: ".action{color:red}",
    after: ".action{color:blue}",
  });
  assert.deepEqual(changedEntries(result), ["action", "action/default"]);
  const action = result.components.find((entry) => entry.path === "action")!;
  assert.deepEqual(
    action.variants[0]!.views.map((view) => view.state),
    ["unchanged", "unchanged", "unchanged", "changed"],
  );
  assert.ok(
    action.variants[1]!.views.every((view) => view.state === "unchanged"),
  );
});

test("missing baseline roots fail instead of becoming page evidence", async (t) => {
  const { input } = await cssMembershipFixture(t, {
    before: ".action{color:red}",
    after: ".action{color:blue}",
  });
  const before = structuredClone(input.before);
  const files = new Map(input.beforeFiles);
  const entry = before.entries.find(
    (entry) => entry.path === "action/default",
  )!;
  for (const view of generatedViews(entry)) {
    Object.assign(view.usage!, { ranges: [] });
    files.set(
      view.path,
      String(files.get(view.path)).replace(
        /<!--mokly-component:(start|end):r-0-->/g,
        "",
      ),
    );
  }
  await assert.rejects(
    assertFastPathEquivalent({ ...input, before, beforeFiles: files }),
    /root/,
  );
});

test("paired Review-ignore removes root elements before collecting own-page proof", async (t) => {
  const source = membershipSource
    .replace(
      "defineComponent, defineScreen",
      "defineComponent, defineScreen, ReviewIgnore",
    )
    .replace(
      '<button className="action">Continue</button>',
      '<ReviewIgnore id="content"><button className="action">Continue</button></ReviewIgnore>',
    );
  const { result } = await cssMembershipFixture(t, {
    source,
    before: ".action{color:red}",
    after: ".action{color:blue}",
  });
  assert.deepEqual(changedEntries(result), []);
});

test("root boundaries rebase when Review-ignore removes only the start marker", async (t) => {
  const partial = renderer.replace(
    "renderToStaticMarkup(input.node)",
    `(input.entry.kind === 'component' ? '<!--mokly-review-ignore:start:prefix-->' + renderToStaticMarkup(input.node).replace('<button', '<!--mokly-review-ignore:end:prefix--><button') : renderToStaticMarkup(input.node))`,
  );
  const source = membershipSource
    .replace("action.entries, ...toolbar.entries,", "action.entries,")
    .replaceAll("<toolbar.Component />", "<action.Component />");
  const { result } = await cssMembershipFixture(t, {
    source,
    renderer: partial,
    before: ".action{color:red}",
    after: ".action{color:blue}",
  });
  assert.deepEqual(changedEntries(result), ["action", "action/default"]);
});

test("the unchanged fast path validates an explicit root boundary", async (t) => {
  const { input } = await cssMembershipFixture(t, { before: "", after: "" });
  const files = new Map(input.beforeFiles);
  for (const view of generatedViews(
    input.before.entries.find((entry) => entry.path === "action/default")!,
  ))
    files.set(
      view.path,
      String(files.get(view.path)).replace(
        "<!--mokly-component:start:r-0-->",
        "",
      ),
    );
  await assert.rejects(
    classifyFixtureWithSources({
      ...input,
      beforeFiles: files,
      afterFiles: files,
      changedPaths: [],
    }),
    /component boundar/,
  );
});

test("material describes documents even when non-CSS root ownership changes", async (t) => {
  const { input } = await cssMembershipFixture(t, { before: "", after: "" });
  const after = structuredClone(input.after);
  for (const view of generatedViews(
    after.entries.find((entry) => entry.path === "action/default")!,
  ))
    Object.assign(view.usage!, {
      resources: [{ path: "picture.svg", componentIds: ["action"] }],
    });
  const result = await assertFastPathEquivalent({ ...input, after });
  const views = result.components.find((entry) => entry.path === "action")!
    .variants[0]!.views;
  assert.ok(views.every((view) => view.state === "changed"));
  assert.ok(views.every((view) => view.material === undefined));
});
