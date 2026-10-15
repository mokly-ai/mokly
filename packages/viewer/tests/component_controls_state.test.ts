import assert from "node:assert/strict";
import { test } from "node:test";

import { encodeProps } from "../src/components/codec.js";
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
import {
  controlDraft,
  WHOLE_PROPS_ERROR,
  type ControlTarget,
} from "../src/shell/control_values.js";

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

test("saved props start without a notice, a detail, or edits", () => {
  const state = initialComponentEditorState(undefined, "s", draft);
  assert.equal(state.notice, undefined);
  assert.equal(state.detail, undefined);
  assert.equal(state.dirty, false);
  assert.equal(state.previews.size, 0);
});

test("Serve's 400 means values not valid together, with its message as the detail", () => {
  const message = "Check the prop values and their allowed limits.";
  const rejected = withRenderFailure(
    edited,
    new ComponentRenderError("invalid-input", message),
  );
  assert.equal(rejected.notice, "invalid-together");
  assert.equal(rejected.detail, message);
  assert.equal(rejected.previews, edited.previews);
  const silent = withRenderFailure(
    edited,
    new ComponentRenderError("invalid-input", " "),
  );
  assert.equal(silent.notice, "invalid-together");
  assert.equal(silent.detail, undefined);
});

test("a 409 stays pending until the render after the new revision", () => {
  const state = withRenderFailure(
    { ...edited, detail: "old" },
    new ComponentRenderError("stale-revision", "The catalogue changed."),
  );
  assert.equal(state.notice, "pending");
  assert.equal(state.detail, undefined);
  assert.equal(state.previews, edited.previews);
  assert.equal(state.draft, draft);
});

test("other failures keep the edits and the preview and offer Try again", () => {
  const failed = (code: RenderErrorCode | "invalid-response") =>
    withRenderFailure(
      { ...edited, detail: "old" },
      new ComponentRenderError(code, "diagnostic"),
    );
  for (const code of [
    "forbidden",
    "unknown-entry",
    "method",
    "expired",
    "too-large",
    "render-failed",
    "capacity",
    "invalid-response",
  ] as const) {
    const state = failed(code);
    assert.equal(state.notice, "failed", code);
    assert.equal(state.detail, undefined, code);
    assert.equal(state.previews, edited.previews, code);
    assert.equal(state.draft, draft, code);
  }
  assert.equal(
    withRenderFailure(edited, new TypeError("offline")).notice,
    "failed",
  );
});

test("an expired preview shows the saved props and keeps the edits", () => {
  const state = withExpiredPreview({ ...edited, detail: "old" });
  assert.equal(state.notice, "expired");
  assert.equal(state.detail, undefined);
  assert.equal(state.previews.size, 0);
  assert.equal(state.dirty, true);
  assert.equal(state.draft, draft);
});

test("a rejected draft highlights its fields, or says its values fail together", () => {
  assert.equal(draftNotice({ label: "Enter up to 5 characters." }), "invalid");
  assert.equal(
    draftNotice({
      [WHOLE_PROPS_ERROR]: "These values are not valid together.",
    }),
    "invalid-together",
  );
});

test("edits and a reset confirmation outlive the target built on each render", () => {
  const saved = (label: string) => {
    const target: ControlTarget = {
      path: "components/action",
      title: "Action",
      kind: "component",
      propSchema: { type: "object", additionalProperties: false },
      props: encodeProps({ label }),
      controls: { label: { kind: "text" } },
      suppliedSlots: [],
      removed: false,
    };
    return initialComponentEditorState(target, "s", controlDraft(target));
  };
  const first = saved("Continue");
  const next = saved("Next");
  assert.notDeepEqual(first.draft, next.draft);
  assert.equal(shownEditorState(edited, next), edited);
  const restored = { ...first, notice: "restored" as const };
  const shown = shownEditorState(restored, next);
  assert.deepEqual(shown, { ...next, notice: "restored" });
  assert.deepEqual(shown.draft, {
    label: { supplied: true, value: "Next" },
  });
  assert.equal(shownEditorState(first, next), next);
  assert.equal(shownEditorState({ ...edited, scope: "other" }, next), next);
  assert.equal(shownEditorState({ ...restored, scope: "other" }, next), next);
});
