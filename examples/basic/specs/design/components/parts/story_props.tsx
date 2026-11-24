import { mockLink } from "@mokly/mokly";

import {
  ControlsPanel,
  SavedPropsPanel,
} from "../../../../../../packages/ui/src/controls-panel/controls-panel.js";
import { PropFields } from "../../../../../../packages/ui/src/prop-field/prop-field.js";
import { PropValues } from "../../../../../../packages/ui/src/props-panel/props-panel.js";
import { useDesignInstance } from "../../library/composition.js";
import { propField } from "../../library/inspector/prop-field.js";
import { CONTROLS_COPY } from "../controls/parts/copy.js";

import type { ComponentPageState } from "./component_details.js";
import { COMPONENT_PAGES } from "./destinations.js";
import { COMPONENT_ENTRIES, COMPONENT_ENTRY_BY_STATE } from "./metadata.js";
import { menuArgs, type MenuArgs } from "./stories.js";

/** The fields that Mokly derives from a Menu story's data args. */
function MenuFields({ args }: { args: MenuArgs }) {
  const scope = useDesignInstance("menu");
  return (
    <PropFields>
      <propField.Component
        moklyInstance={`${scope}-label`}
        label="label"
        inputId="menu-label"
        optional={false}
        supplied
        control={
          <input id="menu-label" type="text" defaultValue={args.label} />
        }
      />
      <propField.Component
        moklyInstance={`${scope}-open`}
        label="open"
        inputId="menu-open"
        optional={false}
        supplied
        control={
          <input id="menu-open" type="checkbox" defaultChecked={args.open} />
        }
      />
    </PropFields>
  );
}

/**
 * The Props tab of a Storybook story, as the shell shows it. The story's args
 * are data, so Mokly derives a text field for `label` and a toggle for
 * `open`, and Serve edits them in place, as it edits any entry with controls.
 * The comparison shows the saved args, with Switch to Current.
 */
export function StoryProps({ state }: { state: ComponentPageState }) {
  const entry = COMPONENT_ENTRY_BY_STATE[state];
  const args = menuArgs(entry.path === COMPONENT_ENTRIES.menuExpanded.path);
  if (state === "story-failed-changes")
    return (
      <SavedPropsPanel
        current={CONTROLS_COPY.switchToCurrent}
        currentHref={mockLink(COMPONENT_PAGES["story-failed"])}
        heading={CONTROLS_COPY.readonlyHeading}
        notice={CONTROLS_COPY.comparison}
        title={entry.title}
      >
        <PropValues
          values={Object.entries(args).map(([name, value]) => ({
            name,
            value: JSON.stringify(value),
          }))}
        />
      </SavedPropsPanel>
    );
  return (
    <ControlsPanel
      dirty={false}
      title={entry.title}
      wording={{
        edited: CONTROLS_COPY.edited,
        heading: CONTROLS_COPY.heading,
        reset: CONTROLS_COPY.reset(entry.title),
        saved: CONTROLS_COPY.saved,
      }}
    >
      <MenuFields args={args} />
    </ControlsPanel>
  );
}
