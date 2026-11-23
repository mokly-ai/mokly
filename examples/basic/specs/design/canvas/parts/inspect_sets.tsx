import type { FramesFilterProps } from "../../library/inspector/frames-filter.js";
import { MetaRow } from "../../parts/metadata_row.js";
import { TagChips } from "../../parts/tag_filter.js";

import {
  COMPONENT_IDENTITIES,
  type ComponentIdentity,
} from "./component_identity.js";
import {
  ActionDisabledControls,
  ChooseVariant,
  ToolbarControls,
  VARIANT_FIELDS,
} from "./component_props.js";
import { CANVAS_PAGES, type CanvasDestination } from "./destinations.js";
import { CANVAS_ENTRIES, type CanvasEntry } from "./entries.js";
import type { CanvasFrameSpec } from "./frames.js";
import {
  InspectFold,
  InspectFrames,
  InspectHead,
  InspectSelection,
} from "./inspect.js";
import {
  ActionUsage,
  InstanceComponents,
  ToolbarUsage,
} from "./inspect_folds.js";
import { InspectFrameSelected, InspectSelected } from "./inspect_selection.js";
import { InspectVariants } from "./inspect_variants.js";
import {
  TOOLBAR_INSTANCES,
  type ToolbarInstanceId,
} from "./instance_records.js";

/**
 * A variant set's Frames filter: its frames are its saved variants in each
 * scheme, so it has no viewport toggles.
 */
export const SET_FILTER = {
  viewports: false,
  mobile: true,
  desktop: true,
  light: true,
  dark: true,
  highlight: false,
} as const satisfies FramesFilterProps;

/**
 * The head of a component's Inspect, as its definition declares it: its
 * description, its source, its schemes, and its tags where it has any.
 */
export function ComponentHead({
  component,
  entry,
}: {
  component: ComponentIdentity;
  entry: CanvasEntry;
}) {
  return (
    <InspectHead
      description={component.description}
      entry={entry}
      rows={
        <>
          <MetaRow name="schemes" label="Schemes">
            light, dark
          </MetaRow>
          {component.tags.length > 0 ? (
            <MetaRow name="tags" label="Tags">
              <TagChips tags={component.tags} />
            </MetaRow>
          ) : null}
        </>
      }
      source={component.source}
    />
  );
}

/**
 * Inspect for the Action, a leaf component, which opens as its variant set:
 * its own example's row, then its saved variants', eight frames in all. The
 * Variants list names the own example first, as the set does; no artboard
 * shows it chosen, so it is a picture. With no frame selected, Props asks
 * for a variant, and a variant in the Variants list selects its Light frame,
 * and on a phone its frame of the appearance's scheme: Default opens it
 * chosen, where Props edits it, and Disabled likewise. With Disabled's frame
 * selected, the list checks Disabled, Selection names the frame, and Props
 * edits Disabled. A leaf renders no registered component, so it has no
 * component tree, and Highlight components is unavailable.
 */
export function ActionInspect({
  disabled,
}: {
  /** Disabled's frame, which choosing Disabled selected. */
  disabled?: CanvasFrameSpec | undefined;
}) {
  const chosen = disabled !== undefined;
  return (
    <>
      <ComponentHead
        component={COMPONENT_IDENTITIES.action}
        entry={CANVAS_ENTRIES.action}
      />
      <InspectVariants
        variants={[
          { label: COMPONENT_IDENTITIES.action.title },
          { label: "Default", to: CANVAS_PAGES.propsEditing },
          {
            label: "Disabled",
            current: chosen,
            to: CANVAS_PAGES.componentSetDisabled,
          },
          { label: "Secondary" },
        ]}
      />
      <InspectFrames
        count={8}
        filter={{ ...SET_FILTER, unavailable: "empty" }}
      />
      {disabled === undefined ? (
        <InspectSelection />
      ) : (
        <InspectFrameSelected frame={disabled} variant="Disabled" />
      )}
      <InspectFold
        count={chosen ? VARIANT_FIELDS["action-disabled"] : undefined}
        initial={chosen}
        name="props"
        open={chosen}
        title="Props"
      >
        {chosen ? <ActionDisabledControls /> : <ChooseVariant />}
      </InspectFold>
      <InspectFold count={3} name="usage" title="Usage">
        <ActionUsage />
      </InspectFold>
    </>
  );
}

/**
 * Inspect for the Toolbar, a composed component, which opens as its variant
 * set: its own example's row, then Default's, its one saved variant, four
 * frames in all. The Variants list names the Toolbar itself first, as the
 * set does; no artboard shows a variant chosen, so each is a picture. Its
 * nested components are the two Actions that it renders, each selecting its
 * instance on the Toolbar · Light frame, the set's first frame. A selection
 * on that frame checks the Toolbar itself, and Props edits its own props;
 * with nothing selected, Props asks for a variant.
 */
export function ToolbarInspect({
  design,
  selected,
}: {
  /** The artboard that renders this Inspect. */
  design?: CanvasDestination | undefined;
  /** The Action that the reader selected on the Toolbar · Light frame. */
  selected?: ToolbarInstanceId | undefined;
}) {
  const chosen = selected !== undefined;
  return (
    <>
      <ComponentHead
        component={COMPONENT_IDENTITIES.toolbar}
        entry={CANVAS_ENTRIES.toolbar}
      />
      <InspectVariants
        variants={[
          { label: COMPONENT_IDENTITIES.toolbar.title, current: chosen },
          { label: "Default" },
        ]}
      />
      <InspectFrames count={4} filter={SET_FILTER} />
      {selected === undefined ? (
        <InspectSelection />
      ) : (
        <InspectSelected initial instance={TOOLBAR_INSTANCES[selected]} />
      )}
      <InspectFold
        count={chosen ? VARIANT_FIELDS.toolbar : undefined}
        name="props"
        title="Props"
      >
        {chosen ? <ToolbarControls /> : <ChooseVariant />}
      </InspectFold>
      <InspectFold count={2} name="usage" title="Usage">
        <ToolbarUsage />
      </InspectFold>
      <InspectFold count={2} name="nested" title="Nested components">
        <InstanceComponents
          design={design}
          records={TOOLBAR_INSTANCES}
          selected={selected}
        />
      </InspectFold>
    </>
  );
}
