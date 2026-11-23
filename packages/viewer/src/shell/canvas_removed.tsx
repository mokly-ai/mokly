/**
 * A removed entry's previous version on the canvas, at and above the layout
 * breakpoint and in the compact layout. The canvas holds the section of the
 * historical views, whose head holds the entry's title, its path, the
 * Removed status and the quiet label `Showing previous version`. While the
 * request runs, or after it failed, the canvas holds that state in place of
 * the section, so it shows no zoom pill. A removed screen's section, from
 * `canvas_removed_screen.tsx`, holds one canvas frame for each historical
 * view. A removed page or document opens as one reading frame.
 */

import { CanvasFrame } from "@mokly/ui/canvas-frame";
import { EmptyState } from "@mokly/ui/empty-state";

import type { ViewerSelection } from "../host/types.js";
import { PREVIOUS_VERSION } from "../previews/copy.js";
import type { SnapshotPresentation } from "../previews/presentation.js";
import type { PreviewContent } from "../previews/request.js";

import { removedReadingView } from "./canvas_removed_frames.js";
import { useCanvasFrameInput } from "./canvas_removed_input.js";
import { RemovedScreenSection } from "./canvas_removed_screen.js";
import {
  RemovedHolding,
  RemovedSection,
  RemovedUnavailable,
  type RemovedSectionProps,
} from "./canvas_removed_section.js";
import { SnapshotFrame } from "./preview_frame.js";
import type { RemovedPreviewData } from "./previews.js";
import type { RemovedPreviewState } from "./use_removed_preview.js";

/** The reading frame of a historical document, which forwards its input. */
function HistoricalReadingFrame({
  label,
  presentation,
  scheme,
  title,
}: {
  label: string;
  presentation: SnapshotPresentation;
  scheme: "dark" | "light";
  title: string;
}) {
  const input = useCanvasFrameInput();
  return (
    <CanvasFrame
      focusVisible={input.focusVisible}
      kind="document"
      label={label}
      scheme={scheme}
    >
      <SnapshotFrame
        canvasInput={input.listener}
        presentation={presentation}
        title={title}
      />
    </CanvasFrame>
  );
}

/**
 * A removed page's or document's section of its one reading frame, which
 * shows a document's historical version of the preview scheme.
 */
function RemovedReadingSection({
  colorScheme,
  content,
  data,
  presentations,
  retry,
}: RemovedSectionProps & {
  content: Extract<PreviewContent, { kind: "document" | "page" }>;
}) {
  const view = removedReadingView(content, colorScheme);
  const presentation = presentations.get(view.url);
  if (!presentation) return <RemovedUnavailable retry={retry} />;
  return (
    <RemovedSection
      colorScheme={colorScheme}
      data={data}
      fitKey={`removed:${data.path}`}
      frames={[
        {
          column: 0,
          key: "reading",
          node: (
            <HistoricalReadingFrame
              label={data.readingLabel ?? data.title}
              presentation={presentation}
              scheme={view.colorScheme}
              title={data.title}
            />
          ),
          row: 0,
        },
      ]}
      kind="document"
    />
  );
}

/** The canvas of a removed entry's previous version in each of its states. */
export function CanvasRemovedStage({
  colorScheme,
  data,
  retry,
  state,
  viewport,
}: {
  colorScheme: ViewerSelection["colorScheme"];
  data: RemovedPreviewData;
  retry(): void;
  state: RemovedPreviewState;
  viewport: ViewerSelection["viewport"];
}) {
  if (state.status === "loading")
    return (
      <RemovedHolding>
        <EmptyState body={PREVIOUS_VERSION.loading} busy />
      </RemovedHolding>
    );
  if (state.status !== "ready")
    return (
      <RemovedUnavailable
        retry={state.status === "failed" ? retry : undefined}
      />
    );
  const content = state.loaded.content;
  const section = {
    colorScheme,
    data,
    presentations: state.presentations,
    retry,
  };
  return content.kind === "screen" ? (
    <RemovedScreenSection
      {...section}
      viewport={viewport}
      views={content.views}
    />
  ) : (
    <RemovedReadingSection {...section} content={content} />
  );
}
