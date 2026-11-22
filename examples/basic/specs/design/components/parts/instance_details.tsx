import { mockLink } from "@mokly/mokly";

import {
  PropsPanel,
  type PropValue,
} from "../../../../../../packages/ui/src/props-panel/props-panel.js";
import { CANVAS_PAGES } from "../../canvas/parts/destinations.js";

import { footerLabelChange } from "./comparison_fixtures.js";
import { toolbarPrompt } from "./fixtures.js";
import type { ScreenPageState } from "./screen_preview.js";

/**
 * The selected instance in the shipped props panel: its component and label,
 * the link to its component's Canvas variant set, and the props that the
 * screen supplies. No artboard shows the hidden Help hint, so its instance
 * names no page, and it adds that it has no visible region.
 */
export function InstanceDetails({ state }: { state: ScreenPageState }) {
  const toolbar = state === "toolbar-selection";
  const help = state === "help-selection";
  const label = toolbar
    ? "Main"
    : help
      ? "Help"
      : state === "nested"
        ? "Toolbar action"
        : state === "consumer"
          ? "Continue"
          : "Footer action";
  const values: readonly PropValue[] = toolbar
    ? [{ name: "prompt", value: `"${toolbarPrompt}"` }]
    : help
      ? [{ name: "visible", value: "false" }]
      : [
          {
            name: "label",
            value: `"${state === "direct-change" ? footerLabelChange.after : footerLabelChange.before}"`,
          },
          { name: "disabled", value: "false" },
        ];
  return (
    <section className="ce-selected-instance" aria-label="Selected instance">
      <PropsPanel
        instance={{
          ...(help
            ? {}
            : {
                href: mockLink(
                  toolbar
                    ? CANVAS_PAGES.componentSetToolbar
                    : CANVAS_PAGES.componentSet,
                ),
              }),
          id: label,
          title: toolbar ? "Toolbar" : help ? "Help hint" : "Action",
        }}
        values={values}
      />
      {help ? <p className="ce-muted">No visible region</p> : null}
    </section>
  );
}
