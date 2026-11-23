/**
 * The Frames section of Inspect: the count of the shown frames and the
 * Frames filter. A screen's filter toggles Mobile, Desktop, Light and Dark,
 * a variant set's only its schemes, and a use case's chooses one viewport
 * and one scheme. A light-only entry's Dark toggle is disabled and reads
 * `Light only`. A toggle that hides a changed view carries the change mark,
 * whose wording it names through `aria-describedby`; each toggle's wording
 * has its own id, apart from the Appearance's. The section holds the
 * Highlight components switch. `@mokly/ui/frames-filter` draws the filter.
 */

import type { Ref } from "react";

import {
  FramesFilter,
  type FramesHighlight,
  type FramesToggle,
  type FramesToggleName,
} from "@mokly/ui/frames-filter";
import { InspectSection } from "@mokly/ui/inspect-panel";

import { DESKTOP_FRAME_SIZE, MOBILE_FRAME_SIZE } from "./canvas_frame_size.js";
import type { UseCaseFramesChoice } from "./canvas_use_case_frames.js";
import { hidesChangedView, type FramesChoice } from "./frames_filter.js";
import {
  useShellIdentifier,
  useShellIdentifierScope,
} from "./identifier_context.js";
import { VIEW_CHANGED_TEXT, type ChangedView } from "./view_marks.js";

/** A size as a toggle's note, such as `390 × 844`. */
const size = ({ height, width }: { height: number; width: number }) =>
  `${width} × ${height}`;

/** What the Frames section shows of one entry. */
export interface FramesSectionModel {
  /** The changed views of the entry, which mark the toggles that hide them. */
  changed: readonly ChangedView[];
  /** The shown viewports and schemes. */
  choice: FramesChoice;
  /** The number of frames that the filter shows. */
  count: number;
  /** Whether the entry has a dark view, without which Dark reads `Light only`. */
  hasDark: boolean;
  /** Whether the filter has viewport toggles, as a screen's has. */
  viewports: boolean;
}

/** The toggles of a screen's or a variant set's filter, with their marks. */
function useToggles(model: FramesSectionModel): FramesToggle[] {
  const identifier = useShellIdentifierScope();
  const toggle = (
    name: FramesToggleName,
    axis: "scheme" | "viewport",
    rest: Partial<FramesToggle> = {},
  ): FramesToggle => {
    const checked = model.choice[name] && rest.disabled !== true;
    return {
      checked,
      // Only the toggle that is off can hide a changed view.
      ...(checked || rest.disabled
        ? {}
        : {
            mark: {
              id: identifier(`mb-frames-changed-${name}`),
              marked: hidesChangedView(name, checked, model.changed),
              text: VIEW_CHANGED_TEXT[axis],
            },
          }),
      name,
      ...rest,
    };
  };
  return [
    ...(model.viewports
      ? [
          toggle("mobile", "viewport", { note: size(MOBILE_FRAME_SIZE) }),
          toggle("desktop", "viewport", { note: size(DESKTOP_FRAME_SIZE) }),
        ]
      : []),
    toggle("light", "scheme"),
    toggle(
      "dark",
      "scheme",
      model.hasDark ? {} : { disabled: true, note: "Light only" },
    ),
  ];
}

/** The Highlight components switch's state and its control. */
export interface FramesHighlightControl {
  onHighlight?: (() => void) | undefined;
  ref?: Ref<HTMLInputElement> | undefined;
  state?: FramesHighlight | undefined;
}

/** The id of the Highlight components switch's description. */
const HIGHLIGHT_DESCRIPTION_ID = "mb-frames-highlight";

/** The Frames section of a screen or of a variant set. */
export function InspectFrames({
  highlight,
  model,
  onToggle,
}: {
  highlight: FramesHighlightControl;
  model: FramesSectionModel;
  onToggle(name: FramesToggleName, checked: boolean): void;
}) {
  const descriptionId = useShellIdentifier(HIGHLIGHT_DESCRIPTION_ID);
  return (
    <InspectSection count={model.count} label="Frames" name="frames">
      <FramesFilter
        descriptionId={descriptionId}
        highlight={highlight.state}
        highlightRef={highlight.ref}
        onHighlight={highlight.onHighlight}
        onToggle={onToggle}
        toggles={useToggles(model)}
      />
    </InspectSection>
  );
}

/** The Frames section of a use case: one viewport and one scheme. */
export function UseCaseFrames({
  choice,
  count,
  hasDark,
  highlight,
  onChoose,
}: {
  choice: UseCaseFramesChoice;
  count: number;
  hasDark: boolean;
  highlight: FramesHighlight;
  onChoose(name: FramesToggleName): void;
}) {
  const descriptionId = useShellIdentifier(HIGHLIGHT_DESCRIPTION_ID);
  return (
    <InspectSection count={count} label="Frames" name="frames">
      <FramesFilter
        descriptionId={descriptionId}
        highlight={highlight}
        onToggle={(name, checked) => {
          if (checked) onChoose(name);
        }}
        single
        toggles={[
          { checked: choice.viewport === "mobile", name: "mobile" },
          { checked: choice.viewport === "desktop", name: "desktop" },
          { checked: choice.scheme === "light" || !hasDark, name: "light" },
          {
            checked: hasDark && choice.scheme === "dark",
            name: "dark",
            ...(hasDark ? {} : { disabled: true, note: "Light only" }),
          },
        ]}
      />
    </InspectSection>
  );
}
