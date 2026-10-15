import assert from "node:assert/strict";
import { test } from "node:test";

import { isValidElement, type ReactElement, type ReactNode } from "react";
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

/** The buttons of the panel and its own alert, which use no hooks. */
function buttons(node: ReactNode): { label: string; element: ReactElement }[] {
  if (Array.isArray(node)) return node.flatMap(buttons);
  if (!isValidElement<{ children?: ReactNode }>(node)) return [];
  const { type } = node;
  if (typeof type === "function")
    return type.name === "ControlsAlert"
      ? buttons((type as (props: unknown) => ReactNode)(node.props))
      : [];
  if (type === "button")
    return [
      {
        label: renderToStaticMarkup(node).replace(/<[^>]+>/g, ""),
        element: node,
      },
    ];
  return buttons(node.props.children);
}

function button(node: ReactNode, label: string) {
  const found = buttons(node).find((item) => item.label === label);
  assert.ok(found, `no button ${label}`);
  return found.element.props as { disabled?: boolean; onClick?: () => void };
}

/** The names a panel gives the elements that recovery actions focus. */
function focusNames(mode: ControlsMode): ControlsFocus[] {
  const names: ControlsFocus[] = [];
  panel(mode, {}, target, (name) => {
    names.push(name);
    return () => undefined;
  });
  return names.sort();
}

test("saved props: Edit props, the entry, and a disabled Reset to it", () => {
  const markup = html("editable");
  assert.match(
    markup,
    /<h3 tabindex="-1">Edit props<\/h3><p>Default · Saved props<\/p>/,
  );
  assert.match(
    markup,
    /<button class="mbk-controls-reset" disabled=""[^>]*>Reset to Default<\/button>/,
  );
  assert.match(markup, /<p class="mbk-controls-restored" role="status"><\/p>/);
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
    /<p>Default <span class="mbk-controls-edited">Edited props<\/span><\/p>/,
  );
  const reset = button(node, "Reset to Default");
  assert.equal(reset.disabled, false);
  assert.equal(reset.onClick, actions.onReset);
  assert.match(
    html("editable", { notice: "restored" }),
    /<p class="mbk-controls-restored" role="status">Saved props restored\.<\/p>/,
  );
});

test("a render in flight keeps the panel and names itself in its own region", () => {
  const markup = html("editable", { dirty: true, notice: "pending" });
  assert.doesNotMatch(markup, /role="alert"|Updating preview/);
  assert.equal(
    renderToStaticMarkup(<EditStatus pending />),
    `<p class="mbk-edit-status" role="status"><span aria-hidden="true" class="mbk-pending-dot"></span>${CONTROLS_COPY.updating}</p>`,
  );
  assert.equal(
    renderToStaticMarkup(<EditStatus pending={false} />),
    '<p class="mbk-edit-status" role="status"></p>',
  );
});

test("a failed render keeps the edits and offers Try again", () => {
  const node = panel("editable", { dirty: true, notice: "failed" });
  assert.match(
    renderToStaticMarkup(node),
    /<div class="mbk-control-alert" role="alert"><strong>The preview could not be updated<\/strong><p>Your edits are kept\. The preview shows the last valid props\.<\/p><button[^>]*>Try again<\/button><\/div>/,
  );
  assert.equal(button(node, "Try again").onClick, actions.onRetry);
});

test("an expired preview keeps the edits and offers Update preview", () => {
  const node = panel("editable", { dirty: true, notice: "expired" });
  assert.match(
    renderToStaticMarkup(node),
    /<strong>The preview of your edits expired<\/strong><p>Your edits are kept\. The preview shows the saved props\.<\/p><button[^>]*>Update preview<\/button>/,
  );
  assert.equal(button(node, "Update preview").onClick, actions.onRetry);
});

test("invalid values: highlighted fields, or values not valid together", () => {
  assert.match(
    html("editable", { dirty: true, notice: "invalid" }),
    /<p class="mbk-control-alert" role="alert">Check the highlighted values\. The preview shows the last valid props\.<\/p>/,
  );
  const node = panel("editable", { dirty: true, notice: "invalid-together" });
  assert.match(
    renderToStaticMarkup(node),
    /<p class="mbk-control-alert" role="alert">These values are not valid together\.<\/p>/,
  );
  assert.deepEqual(
    buttons(node).map(({ label }) => label),
    ["Reset to Default"],
  );
});

test("Serve's message for props it rejected stays in a disclosure", () => {
  const detail = "Check the prop values and their allowed limits.";
  const node = panel("editable", {
    detail,
    dirty: true,
    notice: "invalid-together",
  });
  assert.match(
    renderToStaticMarkup(node),
    /<div class="mbk-control-alert" role="alert"><p>These values are not valid together\.<\/p><details><summary>Details<\/summary><p>Check the prop values and their allowed limits\.<\/p><\/details><\/div>/,
  );
  assert.deepEqual(
    buttons(node).map(({ label }) => label),
    ["Reset to Default"],
  );
});

test("fields wait while editing starts, and a failed start offers Try again", () => {
  const preparing = html("preparing");
  assert.match(
    preparing,
    /<p class="mbk-controls-notice" role="status" tabindex="-1">Preparing to edit props…<\/p><fieldset class="mbk-control-fieldset" disabled="">/,
  );
  assert.match(preparing, /Reset to Default/);
  const node = panel("preparing-failed");
  const markup = renderToStaticMarkup(node);
  assert.match(
    markup,
    /<p class="mbk-control-alert" role="alert">Editing could not start\. <button[^>]*>Try again<\/button><\/p><fieldset class="mbk-control-fieldset" disabled="">/,
  );
  assert.doesNotMatch(markup, /Preparing to edit props/);
  assert.equal(button(node, "Try again").onClick, actions.onStart);
});

test("recovery actions can focus the heading, the fields, and the start status", () => {
  assert.deepEqual(focusNames("editable"), ["fields", "heading"]);
  assert.deepEqual(focusNames("preparing"), ["fields", "heading", "notice"]);
  assert.deepEqual(focusNames("comparison"), ["heading"]);
  assert.match(html("comparison"), /<h3 tabindex="-1">Saved props<\/h3>/);
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
        `^<section class="mbk-component-controls"><div class="mbk-controls-heading"><div><h3 tabindex="-1">Saved props</h3><p>Default</p></div></div><p class="mbk-controls-notice">${notice}</p>`,
      ),
    );
    assert.match(
      markup,
      /<dl aria-label="Supplied props" class="mbk-props"><div><dt>hint<\/dt><dd><code>Not set<\/code><\/dd><\/div><div><dt>label<\/dt><dd><code>&quot;Continue&quot;<\/code><\/dd><\/div><\/dl>/,
    );
    assert.doesNotMatch(markup, /<input|<table|Reset to|Edited props/);
    assert.deepEqual(
      buttons(node).map(({ label }) => label),
      mode === "comparison" ? ["Switch to Current"] : [],
    );
  }
  assert.equal(
    button(panel("comparison"), "Switch to Current").onClick,
    actions.onCurrent,
  );
});

test("an entry without controls shows read-only props and slots; without props, one line", () => {
  const readOnly = html(
    "read-only",
    {},
    { ...target, title: "Badge", controls: {}, suppliedSlots: ["header"] },
  );
  assert.match(readOnly, /<h3 tabindex="-1">Saved props<\/h3><p>Badge<\/p>/);
  assert.match(
    readOnly,
    /<p class="mbk-controls-notice">These props are read-only\.<\/p><dl aria-label="Supplied props" class="mbk-props"><div><dt>label<\/dt><dd><code>&quot;Continue&quot;<\/code><\/dd><\/div><\/dl><h4>Slots<\/h4><p>header<\/p>/,
  );
  assert.doesNotMatch(readOnly, /Not set|hint/);
  assert.equal(
    html("no-props"),
    '<p class="mbk-empty-copy">This entry renders without props.</p>',
  );
});
