import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";

import { compileCatalogue } from "../dist/build/compile.js";
import { loadConfig } from "../dist/config/load.js";

import { componentEntrySource } from "./helpers/component_fixture.js";
import { componentViews, screenView } from "./helpers/component_views.js";
import { createFixture, removeFixture } from "./helpers/fixture.js";

test("consumer graph captures exact invocation sites in all views and strips source before validation and rendering", async (t) => {
  const source = componentEntrySource({
    extra:
      'function Plain(props) { if ("__moklySource" in props) throw new Error("Source leaked"); return props.children; }',
    body: '<Plain><action.Component label="Continue" /></Plain>',
    actionRender:
      '(props) => { if ("__moklySource" in props || "moklyInstance" in props) throw new Error("Reserved prop leaked"); return <button {...props} />; }',
  });
  const fixture = await createFixture(source, {
    extraConfig: 'colorSchemes: ["light", "dark"],',
  });
  t.after(() => removeFixture(fixture));
  const config = await loadConfig(fixture.root);
  const first = await compileCatalogue(config);
  assert.deepEqual(await compileCatalogue(config), first);
  const views = componentViews(first.manifest);
  assert.equal(views.length, 16);
  for (const view of views)
    for (const instance of view.instances) {
      assert.equal(instance.source?.path, "entries/fixture.mockup.tsx");
      const { line, column } = instance.source!;
      const invocationLine = source.split("\n")[line - 1]!;
      assert.ok(
        invocationLine.slice(column - 1).startsWith("<action.Component"),
      );
    }
  for (const [route, html] of first.outputs)
    if (route.endsWith(".html"))
      assert.doesNotMatch(
        html,
        /__moklySource|lineNumber|columnNumber|data-mokly-source/,
      );
});

test("programmatic and already-transformed invocations omit unavailable source", async (t) => {
  const fixture = await createFixture(
    componentEntrySource({
      extra: 'import { jsx } from "react/jsx-runtime";',
      body: '{React.createElement(action.Component, { label: "Programmatic", moklyInstance: "programmatic" })}{jsx(action.Component, { label: "Compiled", moklyInstance: "compiled" })}',
    }),
  );
  t.after(() => removeFixture(fixture));
  const view = screenView(
    await compileCatalogue(await loadConfig(fixture.root)),
  );
  assert.equal(view.instances.length, 2);
  assert.ok(
    view.instances.every((instance) => !Object.hasOwn(instance, "source")),
  );
});

test("wrapper strips supplied metadata from data inputs and replay retains the first invocation source", async (t) => {
  const fixture = await createFixture(
    componentEntrySource({
      body: '{React.createElement(action.Component, { label: "Continue", __moklySource: { path: "entries/caller.tsx", line: 1, column: 2 } })}',
    }),
  );
  t.after(() => removeFixture(fixture));
  const config = await loadConfig(fixture.root);
  const supplied = screenView(await compileCatalogue(config)).instances[0]!;
  assert.deepEqual(supplied.source, {
    path: "entries/caller.tsx",
    line: 1,
    column: 2,
  });
  await fs.writeFile(
    fixture.entryPath,
    componentEntrySource({
      body: '{React.createElement(action.Component, { label: "Continue" })}',
    }),
  );
  const plain = screenView(await compileCatalogue(config)).instances[0]!;
  assert.deepEqual(supplied.props, plain.props);
  assert.equal(supplied.propsKey, plain.propsKey);
  assert.equal(supplied.key, plain.key);
  const source = componentEntrySource({
    extra:
      'let count = 0; function Repeat() { return ++count % 2 ? <action.Component label="Replay" /> : <action.Component label="Replay" />; }',
    paneRender:
      "(props) => <section>{props.children}{props.children}</section>",
    body: "<pane.Component><Repeat /></pane.Component>",
  });
  await fs.writeFile(fixture.entryPath, source);
  const view = screenView(await compileCatalogue(config));
  const replay = view.instances.find(
    (instance) => instance.componentId === "action",
  )!;
  assert.equal(
    replay.source?.column,
    source
      .split("\n")
      .find((line) => line.startsWith("let count"))!
      .indexOf("<action.Component") + 1,
  );
  assert.equal(
    view.ranges.filter(
      (range) =>
        range.target.kind === "instance" &&
        range.target.instanceKey === replay.key,
    ).length,
    2,
  );
});

test("the consumer authoring facade exports the instance resolution helper", async (t) => {
  const fixture = await createFixture(
    componentEntrySource({
      extra:
        'import { resolveInstance } from "@mokly/mokly"; if (typeof resolveInstance !== "function") throw new Error("Missing resolver");',
    }),
  );
  t.after(() => removeFixture(fixture));
  await compileCatalogue(await loadConfig(fixture.root));
});

test("source capture resolves a nested configuration against repoRoot", async (t) => {
  const fixture = await createFixture(componentEntrySource());
  t.after(() => removeFixture(fixture));
  await fs.mkdir(path.join(fixture.root, "tools"));
  await fs.writeFile(
    path.join(fixture.root, "tools/mokly.config.ts"),
    'export default { repoRoot: "..", entriesDir: "../entries", mockupsDir: "../mockups" };',
  );
  const config = await loadConfig(fixture.root, "tools/mokly.config.ts");
  assert.ok(
    screenView(await compileCatalogue(config)).instances.every(
      (instance) => instance.source?.path === "entries/fixture.mockup.tsx",
    ),
  );
});

test("wrapper rejects invalid or accessor source metadata supplied programmatically", async (t) => {
  const fixture = await createFixture();
  t.after(() => removeFixture(fixture));
  const config = await loadConfig(fixture.root);
  for (const value of [
    '{ path: "/absolute.tsx", line: 1, column: 1 }',
    '{ path: "../escape.tsx", line: 1, column: 1 }',
    '{ path: "entries/file.tsx", line: 0, column: 1 }',
  ]) {
    await fs.writeFile(
      fixture.entryPath,
      componentEntrySource({
        body: `{React.createElement(action.Component, { label: "Continue", __moklySource: ${value} })}`,
      }),
    );
    await assert.rejects(compileCatalogue(config), /source/);
  }
  await fs.writeFile(
    fixture.entryPath,
    componentEntrySource({
      extra:
        'function Invoke() { const props = { label: "Continue" }; Object.defineProperty(props, "__moklySource", { enumerable: true, get() { throw new Error("Getter executed"); } }); return action.Component(props); }',
      body: "<Invoke />",
    }),
  );
  await assert.rejects(compileCatalogue(config), /source.*accessor/i);
});
