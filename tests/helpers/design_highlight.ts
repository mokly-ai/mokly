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

/**
 * The state that the shell shows for the view that each artboard depicts, for
 * each scaffold that draws the view controls and each state that it derives.
 * The titles are the shell's own reasons.
 */
const SHELL_STATES: Readonly<Record<string, HighlightSwitch>> = {
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
  // Component pages. Only Toolbar's example renders a registered component.
  "design/components/pages/toolbar": AVAILABLE,
  "design/components/overview": unavailable(
    "No registered components are used in this view.",
  ),
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
      if (JSON.stringify(switches) !== JSON.stringify([expected]))
        violations.push(`${view.route}: ${JSON.stringify(switches)}`);
    }
  }
  return violations;
}
