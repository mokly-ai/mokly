import assert from "node:assert/strict";
import { test } from "node:test";

import { renderToStaticMarkup } from "react-dom/server";

import {
  ALL_FRAMES,
  chosenUseCase,
  hidesChangedView,
  shownSchemes,
  shownViewports,
  toggledFrames,
  workspaceShownAxes,
} from "../src/shell/frames_filter.js";
import { ShellIdentifierProvider } from "../src/shell/identifier_context.js";
import { InspectFrames } from "../src/shell/inspect_frames.js";

test("a toggle turns its frames off, but an axis keeps one toggle on", () => {
  const noDark = toggledFrames(ALL_FRAMES, "dark", false);
  assert.deepEqual(noDark, { ...ALL_FRAMES, dark: false });
  assert.equal(toggledFrames(noDark, "light", false), noDark);
  assert.deepEqual(shownSchemes(noDark, true), ["light"]);
  const mobile = toggledFrames(ALL_FRAMES, "desktop", false);
  assert.equal(toggledFrames(mobile, "mobile", false), mobile);
  assert.deepEqual(shownViewports(mobile), ["mobile"]);
  // An entry without a dark view shows its Light frames whatever Dark says.
  assert.deepEqual(
    shownSchemes(toggledFrames(ALL_FRAMES, "light", false), false),
    ["light"],
  );
});

test("a toggle that is off hides the changed views of its viewport or its scheme", () => {
  const changed = [{ viewport: "mobile", colorScheme: "dark" }] as const;
  assert.equal(hidesChangedView("dark", false, changed), true);
  assert.equal(hidesChangedView("mobile", false, changed), true);
  assert.equal(hidesChangedView("desktop", false, changed), false);
  assert.equal(hidesChangedView("dark", true, changed), false);
  assert.equal(hidesChangedView("light", false, []), false);
});

test("the compact layout describes its picked frame, the first shown one while the filter hides the selection's", () => {
  const selection = { colorScheme: "dark", viewport: "both" } as const;
  assert.deepEqual(
    workspaceShownAxes(false, ALL_FRAMES, true, true, selection),
    { schemes: ["dark", "light"], viewport: "both" },
  );
  assert.deepEqual(
    workspaceShownAxes(false, ALL_FRAMES, true, false, selection),
    { schemes: ["dark"], viewport: "mobile" },
  );
  const desktopLight = { ...ALL_FRAMES, mobile: false, dark: false };
  assert.deepEqual(
    workspaceShownAxes(false, desktopLight, true, false, selection),
    { schemes: ["light"], viewport: "desktop" },
  );
  // A variant set shows its rows' desktop views.
  assert.deepEqual(
    workspaceShownAxes(true, ALL_FRAMES, true, true, selection).viewport,
    "desktop",
  );
});

test("a use case's choice keeps one viewport and one scheme", () => {
  const choice = { scheme: "light", viewport: "desktop" } as const;
  assert.deepEqual(chosenUseCase(choice, "mobile"), {
    scheme: "light",
    viewport: "mobile",
  });
  assert.deepEqual(chosenUseCase(choice, "dark"), {
    scheme: "dark",
    viewport: "desktop",
  });
});

test("the Frames section marks the toggle that hides a changed view and names its wording", () => {
  const html = renderToStaticMarkup(
    <ShellIdentifierProvider prefix="root-">
      <InspectFrames
        highlight={{}}
        model={{
          changed: [{ viewport: "mobile", colorScheme: "dark" }],
          choice: { ...ALL_FRAMES, dark: false },
          count: 2,
          hasDark: true,
          viewports: true,
        }}
        onToggle={() => undefined}
      />
    </ShellIdentifierProvider>,
  );
  // Each toggle names its own wording, apart from the Appearance's.
  assert.match(
    html,
    /aria-describedby="root-mb-frames-changed-dark"[^>]*data-frames-toggle="dark"/,
  );
  assert.match(
    html,
    /data-view-changed-text="scheme" id="root-mb-frames-changed-dark">Other theme changed</,
  );
  assert.doesNotMatch(html, /mb-view-changed-/);
  // The shown toggles carry no mark.
  assert.equal(html.match(/data-view-changed-text=/g)?.length, 1);
  // A light-only screen's Dark toggle reads Light only and carries no mark.
  const lightOnly = renderToStaticMarkup(
    <InspectFrames
      highlight={{}}
      model={{
        changed: [],
        choice: ALL_FRAMES,
        count: 2,
        hasDark: false,
        viewports: true,
      }}
      onToggle={() => undefined}
    />,
  );
  assert.match(lightOnly, /disabled="" type="checkbox"/);
  assert.match(lightOnly, /Light only/);
});
