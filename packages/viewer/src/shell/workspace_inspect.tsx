/**
 * Inspect for a screen's or a component's workspace, in the section order of
 * the inspector design: the head, the comparison evidence of an entry
 * without a Changes tab, the rationale, Variants, Frames, Selection, and the
 * folded Props, Usage and Components; a composed component names the last
 * Nested components, and a leaf has none. A removed screen's previous
 * version has no current bindings, props or usage, so it ends after Frames.
 * A request to show the selection scrolls Inspect to its Selection section.
 */

import { useEffect, useRef, type ReactNode } from "react";

import type { FramesToggleName } from "@mokly/ui/frames-filter";
import {
  InspectFold,
  InspectPanel,
  InspectVariants,
  type InspectVariant,
} from "@mokly/ui/inspect-panel";
import {
  InspectSelection,
  type InspectSelectionState,
} from "@mokly/ui/inspect-selection";

import {
  InspectFrames,
  type FramesHighlightControl,
  type FramesSectionModel,
} from "./inspect_frames.js";

/** A folded section's content and its count, where one is known. */
export interface InspectFoldModel {
  body: ReactNode;
  count?: number | undefined;
}

/** What the workspace's Inspect shows. */
export interface WorkspaceInspectModel {
  /** The Components section, or none for a leaf component. */
  components?: (InspectFoldModel & { title: string }) | undefined;
  /** The comparison evidence of an entry without a Changes tab. */
  evidence?: ReactNode;
  frames: FramesSectionModel;
  /** The head and the rationale. */
  head: ReactNode;
  highlight: FramesHighlightControl;
  onFrames(name: FramesToggleName, checked: boolean): void;
  props: InspectFoldModel;
  /** Whether the entry is a removed entry's previous version. */
  removed: boolean;
  /** Counts the requests to scroll Inspect to Selection. */
  reveal: number;
  selection: InspectSelectionState;
  usage: InspectFoldModel;
  variants: readonly InspectVariant[];
}

export function WorkspaceInspect({ model }: { model: WorkspaceInspectModel }) {
  const selection = useRef<HTMLElement>(null);
  const reveal = model.reveal;
  useEffect(() => {
    if (reveal > 0) selection.current?.scrollIntoView({ block: "start" });
  }, [reveal]);
  return (
    <InspectPanel>
      {model.head}
      {model.evidence}
      <InspectVariants variants={model.variants} />
      <InspectFrames
        highlight={model.highlight}
        model={model.frames}
        onToggle={model.onFrames}
      />
      {model.removed ? null : (
        <>
          <InspectSelection
            sectionRef={selection}
            selection={model.selection}
          />
          <InspectFold count={model.props.count} name="props" title="Props">
            {model.props.body}
          </InspectFold>
          <InspectFold count={model.usage.count} name="usage" title="Usage">
            {model.usage.body}
          </InspectFold>
          {model.components ? (
            <InspectFold
              count={model.components.count}
              name="components"
              title={model.components.title}
            >
              {model.components.body}
            </InspectFold>
          ) : null}
        </>
      )}
    </InspectPanel>
  );
}
