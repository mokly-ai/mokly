import assert from "node:assert/strict";
import { test } from "node:test";

import { renderToStaticMarkup } from "react-dom/server";

import {
  BOTH_SCHEMES,
  canvasShownAxes,
  chosenUseCase,
  framesChoice,
  hidesChangedView,
  shownSchemes,
  shownViewports,
  toggledFrames,
  workspaceShownAxes,
  type FramesChoice,
} from "../src/shell/frames_filter.js";
import { ShellIdentifierProvider } from "../src/shell/identifier_context.js";
import { InspectFrames } from "../src/shell/inspect_frames.js";

/** Every toggle on. */
const EVERY: FramesChoice = {
  dark: true,
  desktop: true,
  light: true,
  mobile: true,
};

test("a toggle turns its frames off, but an axis keeps one toggle on", () => {
  const noDark = toggledFrames(EVERY, "dark", false);
  assert.deepEqual(noDark, { ...EVERY, dark: false });
  assert.equal(toggledFrames(noDark, "light", false), noDark);
  assert.deepEqual(shownSchemes(noDark, true), ["light"]);
  const mobile = toggledFrames(EVERY, "desktop", false);
  assert.equal(toggledFrames(mobile, "mobile", false), mobile);
  assert.deepEqual(shownViewports(mobile), ["mobile"]);
  // An entry without a dark view shows its Light frames whatever Dark says.
  assert.deepEqual(shownSchemes(toggledFrames(EVERY, "light", false), false), [
    "light",
  ]);
});

test("the viewport toggles show the selection's viewport, Both as both on", () => {
  assert.deepEqual(framesChoice(BOTH_SCHEMES, "both"), EVERY);
  assert.deepEqual(framesChoice({ dark: false, light: true }, "desktop"), {
    dark: false,
    desktop: true,
    light: true,
    mobile: false,
  });
  assert.deepEqual(framesChoice(BOTH_SCHEMES, "mobile"), {
    ...EVERY,
    desktop: false,
  });
});

test("the wide canvas lists the toggled viewports, and the compact layout both, of the shown schemes", () => {
  const desktopLight = { ...EVERY, dark: false, mobile: false };
  const entry = { hasDark: true, set: false };
  assert.deepEqual(canvasShownAxes(desktopLight, { ...entry, wide: true }), {
    schemes: ["light"],
    viewports: ["desktop"],
  });
  // The selection's viewport picks the compact layout's frame among them.
  assert.deepEqual(canvasShownAxes(desktopLight, { ...entry, wide: false }), {
    schemes: ["light"],
    viewports: ["desktop", "mobile"],
  });
  // A variant set's frames show the desktop view.
  assert.deepEqual(
    canvasShownAxes(EVERY, { hasDark: true, set: true, wide: false }),
    { schemes: ["light", "dark"], viewports: ["desktop"] },
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

test("a workspace describes the selection's viewport, and the compact layout its picked frame in a shown scheme", () => {
  const selection = { colorScheme: "dark", viewport: "both" } as const;
  const desktop = { ...selection, viewport: "desktop" } as const;
  assert.deepEqual(
    workspaceShownAxes(false, BOTH_SCHEMES, true, true, selection),
    { schemes: ["dark", "light"], viewport: "both" },
  );
  assert.deepEqual(
    workspaceShownAxes(false, BOTH_SCHEMES, true, true, desktop),
    { schemes: ["dark", "light"], viewport: "desktop" },
  );
  assert.deepEqual(
    workspaceShownAxes(false, BOTH_SCHEMES, true, false, selection),
    { schemes: ["dark"], viewport: "mobile" },
  );
  // The picked frame takes a scheme that the filter shows.
  assert.deepEqual(
    workspaceShownAxes(
      false,
      { dark: false, light: true },
      true,
      false,
      desktop,
    ),
    { schemes: ["light"], viewport: "desktop" },
  );
  // A variant set shows its rows' desktop views.
  assert.deepEqual(
    workspaceShownAxes(true, BOTH_SCHEMES, true, true, selection).viewport,
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
          choice: { ...EVERY, dark: false },
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
        choice: EVERY,
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
