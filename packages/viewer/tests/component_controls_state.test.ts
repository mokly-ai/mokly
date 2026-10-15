import assert from "node:assert/strict";
import { test } from "node:test";

import {
  ComponentRenderError,
  type ComponentRenderSuccess,
  type RenderErrorCode,
} from "../src/components/render_types.js";
import {
  draftNotice,
  initialComponentEditorState,
  shownEditorState,
  withExpiredPreview,
  withRenderFailure,
  type ComponentEditorState,
} from "../src/shell/component_controls_state.js";
import { WHOLE_PROPS_ERROR } from "../src/shell/control_values.js";

const preview: ComponentRenderSuccess = {
  renderId: "r-1",
  revision: 2,
  previewUrl: "/mokly-viewer/components/renders/r-1/index.html",
  props: {},
  usage: { status: "ready", instances: [], slots: [], ranges: [] },
};
const draft = { label: { supplied: true, value: "Get started" } };
const edited: ComponentEditorState = {
  ...initialComponentEditorState(undefined, "s", {}),
  draft,
  dirty: true,
  notice: "pending",
  previews: new Map([["mobile/light", preview]]),
};

test("saved props start without a notice and without edits", () => {
  const state = initialComponentEditorState(undefined, "s", draft);
  assert.equal(state.notice, undefined);
  assert.equal(state.dirty, false);
  assert.equal(state.previews.size, 0);
});

test("Serve's 400 means values not valid together; other failures keep Try again", () => {
  const failed = (code: RenderErrorCode | "invalid-response") =>
    withRenderFailure(edited, new ComponentRenderError(code, "diagnostic"));
  assert.equal(failed("invalid-input").notice, "invalid-together");
  for (const code of [
    "forbidden",
    "unknown-entry",
    "method",
    "stale-revision",
    "too-large",
    "render-failed",
    "capacity",
    "invalid-response",
  ] as const) {
    const state = failed(code);
    assert.equal(state.notice, "failed", code);
    assert.equal(state.previews, edited.previews, code);
    assert.equal(state.draft, draft, code);
  }
  assert.equal(
    withRenderFailure(edited, new TypeError("offline")).notice,
    "failed",
  );
});

test("an expired preview shows the saved props and keeps the edits", () => {
  for (const state of [
    withExpiredPreview(edited),
    withRenderFailure(edited, new ComponentRenderError("expired", "gone")),
  ]) {
    assert.equal(state.notice, "expired");
    assert.equal(state.previews.size, 0);
    assert.equal(state.dirty, true);
    assert.equal(state.draft, draft);
  }
});

test("a rejected draft highlights its fields, or says its values fail together", () => {
  assert.equal(draftNotice({ label: "Check this value." }), "invalid");
  assert.equal(
    draftNotice({
      [WHOLE_PROPS_ERROR]: "These values are not valid together.",
    }),
    "invalid-together",
  );
});

test("edits and a reset confirmation outlive the target built on each render", () => {
  const saved = (label: string) =>
    initialComponentEditorState(undefined, "s", {
      label: { supplied: true, value: label },
    });
  const first = saved("Continue");
  const next = saved("Next");
  assert.equal(shownEditorState(edited, next), edited);
  const restored = { ...first, notice: "restored" as const };
  assert.deepEqual(shownEditorState(restored, next), {
    ...next,
    notice: "restored",
  });
  assert.equal(shownEditorState(first, next), next);
  assert.equal(shownEditorState({ ...edited, scope: "other" }, next), next);
  assert.equal(shownEditorState({ ...restored, scope: "other" }, next), next);
});
