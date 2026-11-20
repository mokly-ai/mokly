import { withAncestors } from "./design_accessibility.js";
import { attribute } from "./html.js";
import type { ServedCatalogue } from "./served_design.js";

/** The Highlight components switch of a view, as a reader meets it. */
interface HighlightSwitch {
  disabled: boolean;
  /** The tooltip of the switch, which names the reason that disables it. */
  title: string | undefined;
}

const AVAILABLE: HighlightSwitch = {
  disabled: false,
  title: "Highlight components",
};

function unavailable(title: string): HighlightSwitch {
  return { disabled: true, title };
}

const COMPARISON = unavailable(
  "A comparison is selected. Highlighting is available in Current.",
);
const LOADING = unavailable("Waiting for the component preview.");
const EMPTY = unavailable("No registered components are used in this view.");

/**
 * The switch of each viewport, for an artboard whose phone draws the switch
 * only in an open panel sheet: none where the phone's sheet is closed.
 */
type ViewportSwitches = Readonly<
  Record<"desktop" | "mobile", HighlightSwitch | undefined>
>;

/** The switches that one view of an artboard draws. */
function expectedSwitches(
  expected: HighlightSwitch | ViewportSwitches,
  viewport: string,
): HighlightSwitch[] {
  if ("disabled" in expected) return [expected];
  const state = viewport === "mobile" ? expected.mobile : expected.desktop;
  return state === undefined ? [] : [state];
}

/**
 * The state that the shell shows for the view that each artboard depicts, for
 * each scaffold that draws the view controls and each state that it derives.
 * The titles are the shell's own reasons.
 */
const SHELL_STATES: Readonly<
  Record<string, HighlightSwitch | ViewportSwitches>
> = {
  // A selected screen whose preview is ready: in Browse, in Changes' Current
  // mode, and in the appearance scaffold.
  "design/browse/views/screen": AVAILABLE,
  "design/changes/diff-controls/current": AVAILABLE,
  "design/browse/appearance/overview": AVAILABLE,
  // A diff mode, a removed screen, and a preview that loads or failed.
  "design/changes/diff-controls/overlay": COMPARISON,
  "design/changes/outcomes/removed": unavailable(
    "This preview is unavailable.",
  ),
  "design/browse/loading/preview-loading": LOADING,
  "design/browse/appearance/status/error": unavailable(
    "This preview could not be loaded.",
  ),
  // Profile and Security render no registered component, in Browse and in
  // Changes.
  "design/browse/index-entries/screen": EMPTY,
  "design/browse/index-entries/member-changes": EMPTY,
  // The Canvas viewer's Frames filter holds the switch. Profile renders no
  // registered component, on a desktop and in a phone's panel sheet.
  "design/canvas/inspect/unchanged": EMPTY,
  // Welcome can be highlighted: with the Frames filter's switch on, and in a
  // phone's expanded panel sheet. A phone whose panel sheet is closed draws
  // no switch.
  "design/canvas/inspect/frames": { desktop: AVAILABLE, mobile: undefined },
  "design/canvas/inspect/sections": AVAILABLE,
  // Component pages. Only Toolbar's example renders a registered component.
  "design/components/pages/toolbar": AVAILABLE,
  "design/components/overview": EMPTY,
  "design/components/pages/comparison": COMPARISON,
  "design/components/states/loading/usage-loading": LOADING,
};

/**
 * Each listed artboard view whose Highlight components switch differs from
 * the state that the shell shows for the view it depicts.
 */
export function highlightViolations(catalogue: ServedCatalogue): string[] {
  const violations: string[] = [];
  for (const [path, expected] of Object.entries(SHELL_STATES)) {
    const views = catalogue.views.filter((view) => view.path === path);
    if (!views.length) violations.push(`${path}: no view`);
    for (const view of views) {
      const switches = [...withAncestors(view.document)].flatMap(
        ([element, ancestors]) =>
          element.tagName === "input" &&
          attribute(element, "data-workspace-highlight") !== undefined
            ? [
                {
                  disabled: attribute(element, "disabled") !== undefined,
                  title: ancestors[0] && attribute(ancestors[0], "title"),
                },
              ]
            : [],
      );
      if (
        JSON.stringify(switches) !==
        JSON.stringify(expectedSwitches(expected, view.viewport))
      )
        violations.push(`${view.route}: ${JSON.stringify(switches)}`);
    }
  }
  return violations;
}
