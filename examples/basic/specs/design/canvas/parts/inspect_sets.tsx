import { COMPONENTS } from "../../components/parts/metadata.js";
import type { FramesFilterProps } from "../../library/inspector/frames-filter.js";
import { MetaRow } from "../../parts/metadata_row.js";
import { TagChips } from "../../parts/tag_filter.js";

import {
  ActionDisabledControls,
  ChooseVariant,
  ToolbarDefaultControls,
  VARIANT_FIELDS,
} from "./component_props.js";
import { CANVAS_PAGES, type CanvasDestination } from "./destinations.js";
import { CANVAS_ENTRIES } from "./entries.js";
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
const SET_FILTER = {
  viewports: false,
  mobile: true,
  desktop: true,
  light: true,
  dark: true,
  highlight: false,
} as const satisfies FramesFilterProps;

/** The Schemes row of a component that renders in both schemes. */
function BothSchemes() {
  return (
    <MetaRow name="schemes" label="Schemes">
      light, dark
    </MetaRow>
  );
}

/**
 * Inspect for the Action, a leaf component, which opens as its variant set.
 * With no frame selected, Props asks for a variant, and Disabled in the
 * Variants list selects its Light frame. With that frame selected, the list
 * checks Disabled, Selection names the frame, and Props edits Disabled. A
 * leaf renders no registered component, so it has no component tree, and
 * Highlight components is unavailable.
 */
export function ActionInspect({
  disabled,
}: {
  /** The Disabled · Light frame, where the reader selected it. */
  disabled?: CanvasFrameSpec | undefined;
}) {
  const component = COMPONENTS.action;
  const chosen = disabled !== undefined;
  return (
    <>
      <InspectHead
        description={component.description}
        entry={CANVAS_ENTRIES.action}
        rows={
          <>
            <BothSchemes />
            <MetaRow name="tags" label="Tags">
              <TagChips tags={["forms"]} />
            </MetaRow>
          </>
        }
        source={component.source}
      />
      <InspectVariants
        variants={[
          { label: "Default" },
          {
            label: "Disabled",
            current: chosen,
            to: CANVAS_PAGES.componentSetDisabled,
          },
          { label: "Secondary" },
        ]}
      />
      <InspectFrames
        count={6}
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
 * The Toolbar as the example defines it in
 * `examples/basic/src/components/toolbar`: its description and its source.
 */
const TOOLBAR_DEFINITION = {
  description: "A composed toolbar with caller-supplied content.",
  source: "src/components/toolbar/toolbar.mokly.tsx",
} as const;

/**
 * Inspect for the Toolbar, a composed component, which opens as its variant
 * set: Default, the one saved variant. Its nested components are the two
 * Actions that it renders, each selecting its instance on the Default ·
 * Light frame. A selection on that frame checks Default, and Props edits
 * Default; with nothing selected, Props asks for a variant.
 */
export function ToolbarInspect({
  design,
  selected,
}: {
  /** The artboard that renders this Inspect. */
  design?: CanvasDestination | undefined;
  /** The Action that the reader selected on the Default · Light frame. */
  selected?: ToolbarInstanceId | undefined;
}) {
  const chosen = selected !== undefined;
  return (
    <>
      <InspectHead
        description={TOOLBAR_DEFINITION.description}
        entry={CANVAS_ENTRIES.toolbar}
        rows={<BothSchemes />}
        source={TOOLBAR_DEFINITION.source}
      />
      <InspectVariants variants={[{ label: "Default", current: chosen }]} />
      <InspectFrames count={2} filter={SET_FILTER} />
      {selected === undefined ? (
        <InspectSelection />
      ) : (
        <InspectSelected initial instance={TOOLBAR_INSTANCES[selected]} />
      )}
      <InspectFold
        count={chosen ? VARIANT_FIELDS["toolbar-default"] : undefined}
        name="props"
        title="Props"
      >
        {chosen ? <ToolbarDefaultControls /> : <ChooseVariant />}
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
