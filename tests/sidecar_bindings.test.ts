import assert from "node:assert/strict";
import test from "node:test";

import { digest } from "../packages/mokly/src/authoring/data.js";
import type { BundleResult } from "../packages/mokly/src/generated/sidecar/BundleResult.js";
import type { Definitions } from "../packages/mokly/src/generated/sidecar/Definitions.js";
import type { RenderResult } from "../packages/mokly/src/generated/sidecar/RenderResult.js";

import {
  bundleParams,
  installBindings,
  startSidecar,
} from "./helpers/sidecar.js";

test("bindings supply derived paths, variant context, source, and complete usage drafts", async (context) => {
  const sidecar = startSidecar(context);
  await sidecar.call("hello");
  const { generation } = await sidecar.call<BundleResult>(
    "bundle",
    bundleParams({
      entryFiles: ["usage.mockup.tsx"],
      storiesFiles: [],
      renderer: "entry-renderer.tsx",
    }),
  );
  await sidecar.call("cssModules", { generation, classMaps: {} });
  const params = {
    generation,
    handle: "usage.mockup.tsx#screen",
    entry: { path: "screens/example/variant", title: "Variant" },
    props: {},
    viewport: "mobile",
    colorScheme: "light",
  };
  await assert.rejects(sidecar.call("renderScreen", params), /bindings/);
  const entries = Object.fromEntries(
    ["leaf", "box", "relay", "screen"].map((name) => [
      `usage.mockup.tsx#${name}`,
      { path: `ui/${name}`, title: name },
    ]),
  );
  await installBindings(sidecar, generation, entries);
  const rendered = await sidecar.call<RenderResult>("renderScreen", params);
  assert.match(
    rendered.html,
    /data-path="screens\/example\/variant" data-title="Variant"/,
  );
  assert.match(rendered.html, /href="mock:ui\/leaf"/);
  const [relay, box, first, second] = rendered.instances;
  assert.equal(relay?.id, "relay");
  assert.equal(box?.componentPath, "ui/box");
  assert.deepEqual(box?.owner, { kind: "instance", instanceKey: relay!.key });
  assert.equal(first?.key, second?.key);
  assert.deepEqual(first?.owner, { kind: "entry" });
  assert.equal(
    first?.slotKey,
    digest(["mokly-slot-v1", relay!.key, "children"]),
  );
  assert.equal(first?.order, 0);
  assert.deepEqual(first?.props, {
    label: ["string", "Caller"],
    value: ["number", "-0"],
  });
  assert.equal(first?.source?.path, "usage.mockup.tsx");
  assert.ok(first!.source!.line > 0 && first!.source!.column > 0);
  const supplied = rendered.slots.find(
    (slot) => slot.instanceKey === box!.key && slot.name === "children",
  )!;
  assert.equal(supplied.sourceSlotKey, first?.slotKey);
  assert.equal(supplied.regionIds.length, 2);
  assert.deepEqual(
    rendered.slots.find((slot) => slot.name === "unused")?.regionIds,
    [],
  );
  const markerIds = [
    ...rendered.html.matchAll(/mokly-(?:instance|slot):start id="([^"]+)"/g),
  ].map((match) => match[1]);
  assert.equal(new Set(markerIds).size, markerIds.length);
  assert.ok(
    !rendered.instances.some(
      (instance) => instance.props.label?.[1] === "Unused",
    ),
  );
  assert.deepEqual(
    await sidecar.call<RenderResult>("renderScreen", params),
    rendered,
  );
  entries["usage.mockup.tsx#leaf"] = {
    path: "moved/renamed",
    title: "Renamed",
  };
  await sidecar.call("bindings", { generation, entries });
  const moved = await sidecar.call<RenderResult>("renderScreen", params);
  assert.ok(moved.instances.some((instance) => instance.id === "renamed"));
});

test("saved React slots, placeholder tokens, and disabled ignore scopes remain distinct", async (context) => {
  const sidecar = startSidecar(context);
  await sidecar.call("hello");
  const { generation } = await sidecar.call<BundleResult>(
    "bundle",
    bundleParams({
      entryFiles: ["component.mockup.tsx"],
      renderer: null,
      storiesFiles: [],
    }),
  );
  await sidecar.call("cssModules", {
    generation,
    classMaps: { "control.module.css": { control: "control" } },
  });
  const definitions = await sidecar.call<Definitions>("describe", {
    generation,
  });
  await installBindings(sidecar, generation);
  const handle = definitions.components[0]!.variants[0]!.slots.children!;
  const params = {
    generation,
    handle: "component.mockup.tsx#control",
    entry: { path: "components/control/disabled", title: "Disabled" },
    props: { label: "Saved" },
    viewport: "mobile",
    colorScheme: "light",
    ignoreScope: "disabled",
  };
  const saved = await sidecar.call<RenderResult>("renderComponent", {
    ...params,
    slots: { children: { kind: "saved", handle } },
  });
  assert.match(saved.html, /<b>Saved child<\/b>/);
  assert.ok(!saved.html.includes("mokly-ignore"));
  const placeholder = await sidecar.call<RenderResult>("renderComponent", {
    ...params,
    slots: { children: { kind: "placeholder", token: handle } },
  });
  assert.match(placeholder.html, /<mokly-slot /);
  assert.ok(!placeholder.html.includes("Saved child"));
  await assert.rejects(
    sidecar.call("renderComponent", {
      ...params,
      slots: { children: { kind: "saved", handle: "missing" } },
    }),
    /unknown saved slot/,
  );
});
