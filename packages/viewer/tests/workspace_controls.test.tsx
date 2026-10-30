/**
 * The container of the workspace view controls: it applies the change-mark
 * rule of `view_marks.ts` to the effective scheme, names each mark's wording
 * in the shell's identifier scope, shows Dark preview only for a catalogue
 * with dark previews, and passes the highlight state. `@mokly/ui` tests the
 * markup of the controls themselves.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import { renderToStaticMarkup } from "react-dom/server";

import type { ColorScheme } from "../src/data/axes.js";
import { ShellIdentifierProvider } from "../src/shell/identifier_context.js";
import type { ChangedView } from "../src/shell/view_marks.js";
import { WorkspaceControls } from "../src/shell/workspace_controls.js";

const DARK_MOBILE: readonly ChangedView[] = [
  { viewport: "mobile", colorScheme: "dark" },
];

/** The controls without a store, so the viewport shows both and the scheme is Light. */
function controls(
  changedViews: readonly ChangedView[],
  dark: boolean,
  effectiveColorScheme: ColorScheme,
): string {
  return renderToStaticMarkup(
    <ShellIdentifierProvider prefix="root-">
      <WorkspaceControls
        changedViews={changedViews}
        dark={dark}
        effectiveColorScheme={effectiveColorScheme}
      />
    </ShellIdentifierProvider>,
  );
}

test("a changed view in the other scheme marks Dark preview with the scoped wording", () => {
  const markup = controls(DARK_MOBILE, true, "light");
  assert.match(
    markup,
    /aria-label="Dark preview" aria-describedby="root-mb-view-changed-scheme" aria-pressed="false"/,
  );
  assert.match(
    markup,
    /<span class="mbk-view-changed-text" data-view-changed-text="scheme" id="root-mb-view-changed-scheme">Other theme changed<\/span>/,
  );
  // Both viewports show every viewport, so the viewport select is never marked.
  assert.match(
    markup,
    /<select aria-label="Viewport" data-workspace-viewport=""/,
  );
  assert.match(
    markup,
    /data-view-changed-text="viewport" hidden="" id="root-mb-view-changed-viewport">Other viewport changed</,
  );
});

test("the effective scheme decides the scheme mark", () => {
  const markup = controls(DARK_MOBILE, true, "dark");
  assert.doesNotMatch(markup, /aria-describedby="root-mb-view-changed-scheme"/);
  assert.match(
    markup,
    /data-view-changed-text="scheme" hidden="" id="root-mb-view-changed-scheme"/,
  );
});

test("a catalogue without dark previews has no Dark preview toggle", () => {
  const markup = controls(DARK_MOBILE, false, "light");
  assert.doesNotMatch(markup, /Dark preview/);
  assert.doesNotMatch(markup, /data-workspace-scheme/);
});

test("the highlight state reaches the Highlight components toggle", () => {
  const toggle = () => undefined;
  const on = renderToStaticMarkup(
    <WorkspaceControls
      changedViews={[]}
      dark={false}
      effectiveColorScheme="light"
      highlight={{ active: true, available: true, toggle }}
    />,
  );
  assert.match(
    on,
    /aria-label="Highlight components" aria-description="Inspect component regions and their supplied props." aria-pressed="true" title="Highlight components" data-workspace-highlight="">/,
  );
  const reason = "Waiting for the component preview.";
  const unavailable = renderToStaticMarkup(
    <WorkspaceControls
      changedViews={[]}
      dark={false}
      effectiveColorScheme="light"
      highlight={{ active: false, available: false, reason, toggle }}
    />,
  );
  assert.match(
    unavailable,
    /aria-description="Waiting for the component preview." aria-pressed="false" title="Waiting for the component preview." data-workspace-highlight="" disabled=""/,
  );
});
