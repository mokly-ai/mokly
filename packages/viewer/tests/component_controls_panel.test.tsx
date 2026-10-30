import assert from "node:assert/strict";
import { test } from "node:test";

import { isValidElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { encodeProps } from "../src/components/codec.js";
import type { PropSchema } from "../src/components/prop_types.js";
import { CONTROLS_COPY } from "../src/shell/component_controls_copy.js";
import {
  ComponentControlsPanel,
  EditStatus,
  type ControlsFocus,
} from "../src/shell/component_controls_panel.js";
import {
  initialComponentEditorState,
  type ComponentEditorState,
  type ControlsMode,
} from "../src/shell/component_controls_state.js";
import {
  controlDraft,
  type ControlTarget,
} from "../src/shell/control_values.js";
import type { WorkspaceData } from "../src/shell/workspace_data.js";

const target: ControlTarget = {
  path: "components/action/default",
  title: "Default",
  kind: "component",
  propSchema: {
    type: "object",
    additionalProperties: false,
    required: ["label"],
    properties: { label: { type: "string" }, hint: { type: "string" } },
  } as unknown as PropSchema,
  props: encodeProps({ label: "Continue" }),
  controls: { hint: { kind: "text" }, label: { kind: "text" } },
  suppliedSlots: [],
  removed: false,
};
const saved = initialComponentEditorState(target, "s", controlDraft(target));
const data = { components: [] } as unknown as WorkspaceData;
const actions = {
  onChange: () => undefined,
  onCurrent: () => undefined,
  onReset: () => undefined,
  onRetry: () => undefined,
  onStart: () => undefined,
};

function panel(
  mode: ControlsMode,
  state: Partial<ComponentEditorState> = {},
  shown: ControlTarget = target,
  focus?: (name: ControlsFocus) => () => undefined,
) {
  return ComponentControlsPanel({
    ...actions,
    data,
    ...(focus ? { focus } : {}),
    mode,
    state: { ...saved, ...state },
    target: shown,
  });
}

const html = (...input: Parameters<typeof panel>) =>
  renderToStaticMarkup(panel(...input));

/**
 * The labels of the panel's buttons, in their order. `@mokly/ui` tests that
 * each button reports its press.
 */
function buttons(node: ReactNode): string[] {
  return [
    ...renderToStaticMarkup(node).matchAll(/<button[^>]*>(.*?)<\/button>/g),
  ].map((match) => match[1]!.replace(/<[^>]+>/g, ""));
}

/** The props that the container passes to the `@mokly/ui` panel. */
function passed(node: ReactNode): Readonly<Record<string, unknown>> {
  assert.ok(isValidElement<Record<string, unknown>>(node));
  return node.props;
}

/** The names a panel gives the elements that recovery actions focus. */
function focusNames(mode: ControlsMode): ControlsFocus[] {
  const names: ControlsFocus[] = [];
  renderToStaticMarkup(
    panel(mode, {}, target, (name) => {
      names.push(name);
      return () => undefined;
    }),
  );
  return names.sort();
}

test("saved props: Edit props, the entry, and a disabled Reset to it", () => {
  const markup = html("editable");
  assert.match(
    markup,
    /<h3 class="mbk-reset" tabindex="-1">Edit props<\/h3><p class="mbk-reset">Default · Saved props<\/p>/,
  );
  assert.match(
    markup,
    /<button class="mbk-controls-reset mbk-reset" disabled=""[^>]*>Reset to Default<\/button>/,
  );
  assert.match(
    markup,
    /<p class="mbk-controls-restored mbk-reset" role="status"><\/p>/,
  );
  assert.doesNotMatch(
    markup,
    /role="alert"|Edited props|<fieldset[^>]*disabled/,
  );
  assert.match(markup, /<input[^>]*value="Continue"/);
});

test("edited props: the Edited props badge, and Reset restores the saved props", () => {
  const node = panel("editable", { dirty: true });
  assert.match(
    renderToStaticMarkup(node),
    /<p class="mbk-reset">Default <span class="mbk-controls-edited mbk-reset">Edited props<\/span><\/p>/,
  );
  assert.match(
    renderToStaticMarkup(node),
    /<button class="mbk-controls-reset mbk-reset" type="button">Reset to Default<\/button>/,
  );
  assert.equal(passed(node).onReset, actions.onReset);
  assert.match(
    html("editable", { notice: "restored" }),
    /<p class="mbk-controls-restored mbk-reset" role="status">Saved props restored\.<\/p>/,
  );
});

test("a render in flight keeps the panel and names itself in its own region", () => {
  const markup = html("editable", { dirty: true, notice: "pending" });
  assert.doesNotMatch(markup, /role="alert"|Updating preview/);
  assert.equal(
    renderToStaticMarkup(<EditStatus pending />),
    `<p class="mbk-edit-status mbk-reset" role="status"><span aria-hidden="true" class="mbk-pending-dot mbk-reset"></span>${CONTROLS_COPY.updating}</p>`,
  );
  assert.equal(
    renderToStaticMarkup(<EditStatus pending={false} />),
    '<p class="mbk-edit-status mbk-reset" role="status"></p>',
  );
});

test("a failed render keeps the edits and offers Try again", () => {
  const node = panel("editable", { dirty: true, notice: "failed" });
  assert.match(
    renderToStaticMarkup(node),
    /<div class="mbk-control-alert mbk-reset" role="alert"><strong class="mbk-reset">The preview could not be updated<\/strong><p class="mbk-reset">Your edits are kept\. The preview shows the last valid props\.<\/p><button[^>]*>Try again<\/button><\/div>/,
  );
  assert.deepEqual(buttons(node), ["Reset to Default", "Try again"]);
  assert.equal(passed(node).onRetry, actions.onRetry);
});

test("an expired preview keeps the edits and offers Update preview", () => {
  const node = panel("editable", { dirty: true, notice: "expired" });
  assert.match(
    renderToStaticMarkup(node),
    /<strong class="mbk-reset">The preview of your edits expired<\/strong><p class="mbk-reset">Your edits are kept\. The preview shows the saved props\.<\/p><button[^>]*>Update preview<\/button>/,
  );
  assert.deepEqual(buttons(node), ["Reset to Default", "Update preview"]);
  assert.equal(passed(node).onRetry, actions.onRetry);
});

test("invalid values: highlighted fields, or values not valid together", () => {
  assert.match(
    html("editable", { dirty: true, notice: "invalid" }),
    /<p class="mbk-control-alert mbk-reset" role="alert">Check the highlighted values\. The preview shows the last valid props\.<\/p>/,
  );
  const node = panel("editable", { dirty: true, notice: "invalid-together" });
  assert.match(
    renderToStaticMarkup(node),
    /<p class="mbk-control-alert mbk-reset" role="alert">These values are not valid together\.<\/p>/,
  );
  assert.deepEqual(buttons(node), ["Reset to Default"]);
});

test("fields wait while editing starts, and a failed start offers Try again", () => {
  const preparing = html("preparing");
  assert.match(
    preparing,
    /<p class="mbk-controls-notice mbk-reset" role="status" tabindex="-1">Preparing to edit props…<\/p><fieldset class="mbk-control-fieldset mbk-reset" disabled="">/,
  );
  assert.match(preparing, /Reset to Default/);
  const node = panel("preparing-failed");
  const markup = renderToStaticMarkup(node);
  assert.match(
    markup,
    /<p class="mbk-control-alert mbk-reset" role="alert">Editing could not start\. <button[^>]*>Try again<\/button><\/p><fieldset class="mbk-control-fieldset mbk-reset" disabled="">/,
  );
  assert.doesNotMatch(markup, /Preparing to edit props/);
  assert.deepEqual(buttons(node), ["Reset to Default", "Try again"]);
  assert.equal(passed(node).onStart, actions.onStart);
});

test("recovery actions can focus the heading, the fields, and the start status", () => {
  assert.deepEqual(focusNames("editable"), ["fields", "heading"]);
  assert.deepEqual(focusNames("preparing"), ["fields", "heading", "notice"]);
  assert.deepEqual(focusNames("comparison"), ["heading"]);
  assert.match(
    html("comparison"),
    /<h3 class="mbk-reset" tabindex="-1">Saved props<\/h3>/,
  );
});

test("saved props without fields name the reason and every control's value", () => {
  for (const [mode, notice] of [
    ["comparison", CONTROLS_COPY.comparison],
    ["published", CONTROLS_COPY.published],
    ["removed", CONTROLS_COPY.removed],
  ] as const) {
    const node = panel(mode);
    const markup = renderToStaticMarkup(node);
    assert.match(
      markup,
      new RegExp(
        `^<section class="mbk-component-controls mbk-reset"><div class="mbk-controls-heading mbk-reset"><div class="mbk-reset"><h3 class="mbk-reset" tabindex="-1">Saved props</h3><p class="mbk-reset">Default</p></div></div><p class="mbk-controls-notice mbk-reset">${notice}</p>`,
      ),
    );
    assert.match(
      markup,
      /<dl aria-label="Supplied props" class="mbk-props mbk-reset"><div class="mbk-reset"><dt class="mbk-reset">hint<\/dt><dd class="mbk-reset"><code class="mbk-reset">Not set<\/code><\/dd><\/div><div class="mbk-reset"><dt class="mbk-reset">label<\/dt><dd class="mbk-reset"><code class="mbk-reset">&quot;Continue&quot;<\/code><\/dd><\/div><\/dl>/,
    );
    assert.doesNotMatch(markup, /<input|<table|Reset to|Edited props/);
    assert.deepEqual(
      buttons(node),
      mode === "comparison" ? ["Switch to Current"] : [],
    );
  }
  assert.equal(passed(panel("comparison")).onCurrent, actions.onCurrent);
});

test("an entry without controls shows read-only props and slots; without props, one line", () => {
  const readOnly = html(
    "read-only",
    {},
    { ...target, title: "Badge", controls: {}, suppliedSlots: ["header"] },
  );
  assert.match(
    readOnly,
    /<h3 class="mbk-reset" tabindex="-1">Saved props<\/h3><p class="mbk-reset">Badge<\/p>/,
  );
  assert.match(
    readOnly,
    /<p class="mbk-controls-notice mbk-reset">These props are read-only\.<\/p><dl aria-label="Supplied props" class="mbk-props mbk-reset"><div class="mbk-reset"><dt class="mbk-reset">label<\/dt><dd class="mbk-reset"><code class="mbk-reset">&quot;Continue&quot;<\/code><\/dd><\/div><\/dl><h4 class="mbk-reset">Slots<\/h4><p class="mbk-reset">header<\/p>/,
  );
  assert.doesNotMatch(readOnly, /Not set|hint/);
  assert.equal(
    html("no-props"),
    '<p class="mbk-empty-copy mbk-reset">This entry renders without props.</p>',
  );
});
