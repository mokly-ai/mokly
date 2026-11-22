import { withAncestors } from "./design_accessibility.js";
import { attribute } from "./html.js";
import type { ServedCatalogue } from "./served_design.js";

/** The Highlight components switch of a view, as a reader meets it. */
interface HighlightSwitch {
  disabled: boolean;
  /** The tooltip of the switch, which names the reason that disables it. */
  title: string | undefined;
  /** The description of a disabled switch, which names the same reason. */
  description?: string | undefined;
}

const AVAILABLE: HighlightSwitch = {
  disabled: false,
  title: "Highlight components",
};

function unavailable(title: string): HighlightSwitch {
  return { disabled: true, title, description: title };
}

const COMPARISON = unavailable(
  "A comparison is selected. Highlighting is available in Current.",
);
const REMOVED = unavailable("This preview is unavailable.");
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
  // A removed screen has no current preview to inspect: Farewell's Inspect,
  // on a desktop and in a phone's panel sheet, and Timeline's, whose phone
  // draws no switch while its panel sheet is closed.
  "design/canvas/outcomes/removed/inspect": REMOVED,
  "design/canvas/outcomes/removed/no-view": {
    desktop: REMOVED,
    mobile: undefined,
  },
  // The Canvas viewer's Frames filter holds the switch. Profile renders no
  // registered component, on a desktop and in a phone's panel sheet.
  "design/canvas/inspect/unchanged": EMPTY,
  // Welcome can be highlighted: with the Frames filter's switch on, and in a
  // phone's expanded panel sheet. A phone whose panel sheet is closed draws
  // no switch.
  "design/canvas/inspect/frames": { desktop: AVAILABLE, mobile: undefined },
  "design/canvas/inspect/sections": AVAILABLE,
  // A variant set: the Action renders no registered component, on a desktop
  // and in a phone's open panel sheet; the Toolbar renders two Actions, so it
  // can be highlighted, and its phone, with the sheet closed, draws no switch.
  "design/canvas/stage/component-set/disabled": EMPTY,
  "design/canvas/stage/component-set/toolbar": {
    desktop: AVAILABLE,
    mobile: undefined,
  },
  // Details without inspection metadata, on a desktop and in a phone's open
  // panel sheet: the reason differs from an empty view's.
  "design/canvas/components/inspection/unavailable": unavailable(
    "Component inspection is unavailable for this view.",
  ),
  // A comparison of the Action, whose read-only props a desktop and a
  // phone's open panel sheet show.
  "design/canvas/components/compare/props": COMPARISON,
  // An entry whose detail loads, and one whose detail failed, which mounts
  // no frame, so the shell keeps waiting for the preview. A phone whose
  // panel sheet is closed draws no switch.
  "design/canvas/loading/entry": { desktop: LOADING, mobile: undefined },
  "design/canvas/loading/entry/failed": { desktop: LOADING, mobile: undefined },
  // The Action's Usage while its detail loads, on a desktop and in a phone's
  // open panel sheet.
  "design/canvas/components/usage/loading": LOADING,
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
        ([element, ancestors]) => {
          if (
            element.tagName !== "input" ||
            attribute(element, "data-workspace-highlight") === undefined
          )
            return [];
          const disabled = attribute(element, "disabled") !== undefined;
          return [
            {
              disabled,
              title: ancestors[0] && attribute(ancestors[0], "title"),
              // A disabled switch also gives its reason to assistive
              // technology.
              ...(disabled
                ? { description: attribute(element, "aria-description") }
                : {}),
            },
          ];
        },
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
