import assert from "node:assert/strict";
import { test } from "node:test";

import { encodeProps } from "../src/components/codec.js";
import type { ComponentRenderSuccess } from "../src/components/render_types.js";
import type { GeneratedComponentView } from "../src/components/views.js";
import { controlsMode } from "../src/shell/component_controls_state.js";
import {
  acceptedRender,
  editContextKey,
  EditLifecycle,
  EDIT_DEBOUNCE_MS,
  shouldRerender,
} from "../src/shell/component_edit_lifecycle.js";
import type { ControlTarget } from "../src/shell/control_values.js";
import type { TemporaryPreviews } from "../src/shell/data_context.js";

function previews(revision: number, generation = "g1"): TemporaryPreviews {
  return {
    generation,
    revision,
    deploymentId: "d1",
    render: () => Promise.reject(new Error("unused")),
    expired: () => Promise.resolve(false),
  };
}

function result(revision: number): readonly [string, ComponentRenderSuccess] {
  return [
    "mobile/light",
    {
      renderId: "r-1",
      revision,
      previewUrl: "/mokly-viewer/components/renders/r-1/index.html",
      props: {},
      usage: { status: "ready", instances: [], slots: [], ranges: [] },
    },
  ];
}

const view = (viewport: "mobile" | "desktop"): GeneratedComponentView => ({
  path: `${viewport}.html`,
  viewport,
  colorScheme: "light",
});

test("text and number edits wait 150 ms, and a newer edit replaces a pending one", (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const lifecycle = new EditLifecycle();
  const submitted: string[] = [];
  lifecycle.schedule(false, () => submitted.push("first"));
  t.mock.timers.tick(EDIT_DEBOUNCE_MS - 1);
  assert.equal(submitted.length, 0);
  lifecycle.schedule(false, () => submitted.push("second"));
  t.mock.timers.tick(EDIT_DEBOUNCE_MS - 1);
  assert.equal(submitted.length, 0);
  t.mock.timers.tick(1);
  assert.deepEqual(submitted, ["second"]);
  assert.equal(EDIT_DEBOUNCE_MS, 150);
});

test("boolean and select edits submit at once", (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const lifecycle = new EditLifecycle();
  const submitted: string[] = [];
  lifecycle.schedule(false, () => submitted.push("text"));
  lifecycle.schedule(true, () => submitted.push("toggle"));
  assert.deepEqual(submitted, ["toggle"]);
  t.mock.timers.tick(EDIT_DEBOUNCE_MS);
  assert.deepEqual(submitted, ["toggle"]);
});

test("cancel drops the pending edit and aborts the active render", (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const lifecycle = new EditLifecycle();
  const operation = lifecycle.begin();
  assert.equal(operation.current(), true);
  let submitted = false;
  lifecycle.schedule(false, () => (submitted = true));
  assert.equal(operation.signal.aborted, true);
  assert.equal(operation.current(), false);
  lifecycle.cancel();
  t.mock.timers.tick(EDIT_DEBOUNCE_MS);
  assert.equal(submitted, false);
});

test("a newer render supersedes the one in flight", () => {
  const lifecycle = new EditLifecycle();
  const older = lifecycle.begin();
  const newer = lifecycle.begin();
  assert.equal(older.signal.aborted, true);
  assert.equal(older.current(), false);
  assert.equal(newer.current(), true);
});

test("a render result is accepted only for the installed revision", () => {
  assert.equal(acceptedRender([result(4)], previews(4)), true);
  assert.equal(acceptedRender([result(4), result(5)], previews(4)), false);
  assert.equal(acceptedRender([result(3)], previews(4)), false);
  assert.equal(acceptedRender([result(4)], undefined), false);
});

test("a revision, a render generation or the views change the edit context", () => {
  const key = editContextKey([view("mobile")], previews(4));
  assert.equal(editContextKey([view("mobile")], previews(4)), key);
  assert.notEqual(editContextKey([view("mobile")], previews(5)), key);
  assert.notEqual(editContextKey([view("mobile")], previews(4, "g2")), key);
  assert.notEqual(editContextKey([view("desktop")], previews(4)), key);
  assert.notEqual(editContextKey([view("mobile")], undefined), key);
});

test("edited props render again after the context or the capability changes", () => {
  assert.equal(shouldRerender("a", "b", true, true), true);
  assert.equal(shouldRerender("a", "a", true, true), false);
  assert.equal(shouldRerender("a", "b", false, true), false);
  assert.equal(shouldRerender("a", "b", true, false), false);
});

test("the Props panel edits only a current entry with controls in Serve", () => {
  const target: ControlTarget = {
    path: "components/action",
    title: "Action",
    kind: "component",
    propSchema: { type: "object", additionalProperties: false },
    props: encodeProps({ label: "Go" }),
    controls: { label: { kind: "text" } },
    suppliedSlots: [],
    removed: false,
  };
  assert.equal(controlsMode(target, false, "ready"), "editable");
  assert.equal(controlsMode(target, false, "preparing"), "preparing");
  assert.equal(controlsMode(target, false, "failed"), "preparing-failed");
  assert.equal(controlsMode(target, false, undefined), "published");
  assert.equal(controlsMode(target, true, "ready"), "comparison");
  assert.equal(controlsMode(target, true, undefined), "comparison");
  const removed = { ...target, removed: true };
  assert.equal(controlsMode(removed, false, "ready"), "removed");
  assert.equal(controlsMode(removed, true, undefined), "removed");
  const readOnly = { ...target, controls: {} };
  assert.equal(controlsMode(readOnly, false, "ready"), "read-only");
  assert.equal(controlsMode(readOnly, true, undefined), "read-only");
  const slotsOnly = { ...readOnly, props: {}, suppliedSlots: ["header"] };
  assert.equal(controlsMode(slotsOnly, false, "ready"), "read-only");
  const empty = { ...readOnly, props: {} };
  assert.equal(controlsMode(empty, false, "ready"), "no-props");
  assert.equal(controlsMode(empty, true, undefined), "no-props");
});
