import { mockLink } from "@mokly/mokly";

import { SavedPropsPanel } from "../../../../../../packages/ui/src/controls-panel/controls-panel.js";
import type { PropValue } from "../../../../../../packages/ui/src/props-panel/props-panel.js";
import { CONTROLS_COPY } from "../controls/parts/copy.js";
import type { ControlsState } from "../controls/parts/fixtures.js";
import { ReadOnlyPanel, RemovedPanel } from "../controls/parts/limits.js";
import { ControlsPanel } from "../controls/parts/panel.js";

import {
  actionEntries,
  ActionPropValues,
  type ActionEntry,
} from "./action_props.js";
import { checklistCompleted, checklistTitle } from "./checklist.js";
import type { ComponentPageState } from "./component_details.js";
import { COMPONENT_PAGES, CONTROLS_PAGES } from "./destinations.js";
import { toolbarPrompt } from "./fixtures.js";
import {
  COMPONENT_ENTRIES,
  COMPONENT_ENTRY_BY_STATE,
  type ComponentEntryMetadata,
} from "./metadata.js";

/** The Action entry a page shows: a saved variant or the parent's own entry. */
export function actionEntryOf(entry: ComponentEntryMetadata): ActionEntry {
  return entry.path === COMPONENT_ENTRIES.actionDisabled.path
    ? "disabled"
    : entry.path === COMPONENT_ENTRIES.actionDefault.path
      ? "default"
      : "parent";
}

/** The saved props of the components whose authors declare no controls. */
const SUPPLIED_PROPS: Partial<
  Record<ComponentPageState, readonly PropValue[]>
> = {
  toolbar: [{ name: "prompt", value: `"${toolbarPrompt}"` }],
  hidden: [{ name: "visible", value: "false" }],
  unused: [{ name: "label", value: '"New"' }],
  added: [{ name: "label", value: '"New"' }],
  "overlay-tall": [
    { name: "title", value: `"${checklistTitle}"` },
    { name: "completed", value: String(checklistCompleted) },
  ],
};

/** The controls of each Action entry in Current. */
const CONTROLS_STATES = {
  parent: "parent",
  default: "default",
  disabled: "variant",
} as const satisfies Record<ActionEntry, ControlsState>;

/** The page that shows each Action entry in Current, which Switch to Current opens. */
const CURRENT_PAGES = {
  parent: COMPONENT_PAGES.default,
  default: CONTROLS_PAGES.default,
  disabled: COMPONENT_PAGES.disabled,
} as const satisfies Record<ActionEntry, string>;

/** The pages that compare, whose Props tab shows the saved props read-only. */
const COMPARING: ReadonlySet<ComponentPageState> = new Set([
  "comparison",
  "overlay",
  "difference",
  "style-changed",
]);

/**
 * The Props tab of a component page in place, as the shell shows it: the
 * saved props of a removed variant and of a component without declared
 * controls read-only, a comparison's saved props read-only with Switch to
 * Current, and otherwise the shown entry's controls.
 */
export function ComponentProps({ state }: { state: ComponentPageState }) {
  const entry = COMPONENT_ENTRY_BY_STATE[state];
  if (state === "removed") return <RemovedPanel />;
  if (entry.component !== "action")
    return (
      <ReadOnlyPanel title={entry.title} values={SUPPLIED_PROPS[state] ?? []} />
    );
  const action = actionEntryOf(entry);
  if (!COMPARING.has(state))
    return <ControlsPanel state={CONTROLS_STATES[action]} />;
  const shown = actionEntries[action];
  return (
    <SavedPropsPanel
      current={CONTROLS_COPY.switchToCurrent}
      currentHref={mockLink(CURRENT_PAGES[action])}
      heading={CONTROLS_COPY.readonlyHeading}
      notice={CONTROLS_COPY.comparison}
      title={shown.title}
    >
      <ActionPropValues props={shown.props} />
    </SavedPropsPanel>
  );
}
