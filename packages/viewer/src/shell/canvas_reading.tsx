/**
 * A page's or a Markdown document's canvas in the wide layout: one reading
 * frame, named by its source file, whose document reflows to the reading
 * size that the canvas gives. It shows the document of the preview scheme,
 * as the one-frame stage does, with the Light-only band above the canvas.
 */

import { useContext } from "react";

import { CanvasFrame } from "@mokly/ui/canvas-frame";
import { PreviewIframe } from "@mokly/ui/preview-frame";
import { LightOnlyBand } from "@mokly/ui/scheme-fallback";

import { readingFrameLabel } from "./canvas_frames.js";
import { CanvasEntryStage } from "./canvas_stage.js";
import type { Catalogue } from "./catalogue.js";
import { DisplaySelection } from "./display_context.js";
import {
  documentScheme,
  useDocumentFrame,
  type DocumentEntry,
} from "./document_stage_frame.js";
import { FrameStageContext } from "./frame_layout_context.js";
import { targetHead } from "./head.js";
import { pageComparisonEvidence } from "./page_evidence_data.js";
import { focusThen } from "./retry_focus.js";
import { documentLightOnly } from "./scheme_fallback.js";

/** The reading frame: the document of one scheme, mounted by its adapter. */
function ReadingFrame({
  entry,
  fragment,
  scheme,
}: {
  entry: DocumentEntry;
  fragment: string | undefined;
  scheme: "dark" | "light";
}) {
  const stage = useContext(FrameStageContext);
  const frame = useDocumentFrame(entry, scheme, fragment, stage);
  return (
    <CanvasFrame
      error={frame.status === "error"}
      kind="document"
      label={readingFrameLabel(entry)}
      retry={{ onClick: focusThen(frame.frameRef, frame.retry) }}
      scheme={scheme}
    >
      {frame.source ? (
        <PreviewIframe
          busy={frame.status === "loading"}
          data={{
            "data-mokly-fragment-frame": "",
            "data-mokly-frame-state": frame.status,
          }}
          key={frame.generation}
          ref={frame.frameRef}
          src={frame.initialSource}
          title={entry.title}
        />
      ) : null}
    </CanvasFrame>
  );
}

export function CanvasReadingStage({
  catalogue,
  entry,
  fragment,
}: {
  catalogue: Catalogue;
  entry: DocumentEntry;
  fragment?: string | undefined;
}) {
  const selection = useContext(DisplaySelection);
  const scheme = documentScheme(entry, selection.colorScheme);
  const head = targetHead(catalogue, { kind: "entry", entry });
  const status =
    entry.kind === "page"
      ? pageComparisonEvidence(catalogue, entry.path)?.status
      : undefined;
  return (
    <>
      {documentLightOnly(entry, catalogue.hasDarkFragments) ? (
        <LightOnlyBand />
      ) : null}
      <CanvasEntryStage
        fitKey={entry.path}
        frames={[
          {
            column: 0,
            key: "reading",
            node: (
              <ReadingFrame entry={entry} fragment={fragment} scheme={scheme} />
            ),
            row: 0,
          },
        ]}
        kind="document"
        path={head.path}
        status={status}
        title={head.title}
      />
    </>
  );
}
