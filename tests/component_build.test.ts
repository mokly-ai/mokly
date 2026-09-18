import assert from "node:assert/strict";
import { test } from "node:test";

import { compileCatalogue } from "../dist/build/compile.js";
import { validateComponentRanges } from "../dist/components/ranges.js";
import { loadConfig } from "../dist/config/load.js";
import { parseManifest, serializeManifest } from "../dist/registry/manifest.js";
import { decodeProps } from "../packages/viewer/dist/components/codec.js";
import {
  instanceKey,
  slotKey,
} from "../packages/viewer/dist/components/keys.js";

import { componentEntrySource } from "./helpers/component_fixture.js";
import { createFixture, removeFixture } from "./helpers/fixture.js";

async function compile(
  t: { after: (fn: () => Promise<void>) => void },
  options: Parameters<typeof componentEntrySource>[0] = {},
) {
  const fixture = await createFixture(componentEntrySource(options), {
    extraConfig: 'colorSchemes: ["light", "dark"],',
  });
  t.after(() => removeFixture(fixture));
  return compileCatalogue(await loadConfig(fixture.root));
}

test("component registration emits deterministic variants and actual per-view ownership", async (t) => {
  const result = await compile(t);
  assert.equal(result.manifest.schemaVersion, 5);
  const action = result.manifest.entries.find((entry) => entry.id === "action");
  assert.ok(action?.kind === "component");
  assert.equal(
    action.variants[0]!.fragments.mobile,
    "components/action.variants/default.mobile.html",
  );
  assert.equal(
    action.variants[1]!.darkFragments?.desktop,
    "components/action.variants/disabled.desktop.dark.html",
  );
  assert.deepEqual(
    action.variants[0]!.componentViews.map((view) => [
      view.viewport,
      view.colorScheme,
      view.instances.length,
    ]),
    [
      ["mobile", "light", 0],
      ["mobile", "dark", 0],
      ["desktop", "light", 0],
      ["desktop", "dark", 0],
    ],
  );
  const screen = result.manifest.entries.find((entry) => entry.id === "home");
  assert.ok(screen?.kind === "screen");
  const view = screen.componentViews![0]!;
  assert.equal(view.instances.length, 5);
  const pane = view.instances.find(
    (instance) => instance.componentId === "pane",
  )!;
  const inside = view.instances.find(
    (instance) => instance.owner.kind === "instance",
  )!;
  assert.deepEqual(inside.owner, { kind: "instance", instanceKey: pane.key });
  const slotted = view.instances.find((instance) => instance.slotKey)!;
  assert.deepEqual(slotted.owner, { kind: "entry" });
  assert.equal(slotted.slotKey, slotKey(pane.key, "children"));
  assert.equal(
    slotted.key,
    instanceKey({ kind: "entry" }, slotted.slotKey, "action"),
  );
  assert.deepEqual(decodeProps(slotted.props), { label: "Slot action" });
  const html = result.outputs.get(screen.fragments.mobile)!;
  assert.equal(html.includes("<template"), false);
  assert.match(
    html,
    /href="..\/components\/action.variants\/default.mobile.html"/,
  );
  const ranges = validateComponentRanges(html, view.ranges);
  const hidden = view.instances.find((instance) => instance.id === "hidden")!;
  const hiddenRange = ranges.find(
    (range) =>
      range.record.target.kind === "instance" &&
      range.record.target.instanceKey === hidden.key,
  )!;
  assert.equal(hiddenRange.contentStart, hiddenRange.contentEnd);
  assert.deepEqual(
    parseManifest(JSON.parse(serializeManifest(result.manifest))),
    result.manifest,
  );
});

test("one captured slot can render twice without duplicating its logical inputs", async (t) => {
  const result = await compile(t, {
    paneRender:
      "(props) => <section>{props.children}<aside>{props.children}</aside></section>",
  });
  const home = result.manifest.entries.find((entry) => entry.id === "home");
  assert.ok(home?.kind === "screen");
  const view = home.componentViews![0]!;
  const slotted = view.instances.filter((instance) => instance.slotKey);
  assert.equal(slotted.length, 1);
  assert.equal(
    view.ranges.filter(
      (range) =>
        range.target.kind === "instance" &&
        range.target.instanceKey === slotted[0]!.key,
    ).length,
    2,
  );
});

for (const [name, options, error] of [
  [
    "duplicate invocations",
    {
      body: '<action.Component label="One" /><action.Component label="One" />',
    },
    /duplicate component instance/,
  ],
  [
    "unknown data",
    { body: '<action.Component label="One" extra={1} />' },
    /unknown prop/,
  ],
  ["missing data", { body: "<action.Component />" }, /required prop/],
  [
    "null instance identity",
    { body: '<action.Component label="One" moklyInstance={null} />' },
    /moklyInstance must/,
  ],
  [
    "unregistered wrapper",
    { exports: "pane.entry,", extra: "" },
    /missing-child|not exported/,
  ],
  [
    "forged sentinel",
    { body: '<template data-mokly-component-start="b-999" />' },
    /unknown component sentinel/,
  ],
  [
    "manual ignore enclosing components",
    {
      body: '<ReviewIgnore id="bad"><action.Component label="One" /></ReviewIgnore>',
    },
    /ReviewIgnore cannot enclose/,
  ],
  [
    "invalid unused slot",
    {
      body: "<pane.Component children={{ bad: true }} />",
      paneRender: "() => null",
    },
    /renderable React node/,
  ],
] as const)
  test(`component build rejects ${name}`, async (t) => {
    await assert.rejects(compile(t, options), error);
  });

test("v4 retains explicit dependency declarations separately from source attribution", async (t) => {
  const result = await compile(t);
  const action = result.manifest.entries.find(
    (entry) => entry.id === "action",
  )!;
  assert.deepEqual(Reflect.get(action, "declaredDependencies"), ["notes.md"]);
  assert.deepEqual(action.dependencies, [
    "entries/fixture.mockup.tsx",
    "notes.md",
  ]);
});
