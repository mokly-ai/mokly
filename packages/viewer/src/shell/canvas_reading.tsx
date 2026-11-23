/**
 * A page's or a Markdown document's canvas in the wide layout: one reading
 * frame, named by its source file, whose document reflows to the reading
 * size that the canvas gives. It shows the document of the preview scheme,
 * as the one-frame stage does. A document without a dark render keeps its
 * light document under Dark, and its label then names that fallback.
 */

import { useContext } from "react";

import { CanvasFrame } from "@mokly/ui/canvas-frame";
import { PreviewIframe } from "@mokly/ui/preview-frame";

import { useLiveFrameInput } from "./canvas_frame_input.js";
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
  label,
  scheme,
}: {
  entry: DocumentEntry;
  fragment: string | undefined;
  label: string;
  scheme: "dark" | "light";
}) {
  const stage = useContext(FrameStageContext);
  const onCanvasInput = useLiveFrameInput();
  const frame = useDocumentFrame(entry, scheme, fragment, stage, onCanvasInput);
  return (
    <CanvasFrame
      error={frame.status === "error"}
      kind="document"
      label={label}
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
  // Under Dark, a document of a catalogue with a dark axis that has no dark
  // render shows its light document, and its label says so.
  const lightOnly =
    selection.colorScheme === "dark" &&
    documentLightOnly(entry, catalogue.hasDarkFragments);
  const file = readingFrameLabel(entry);
  return (
    <CanvasEntryStage
      fitKey={entry.path}
      frames={[
        {
          column: 0,
          key: "reading",
          node: (
            <ReadingFrame
              entry={entry}
              fragment={fragment}
              label={lightOnly ? `${file} · Light only` : file}
              scheme={scheme}
            />
          ),
          row: 0,
        },
      ]}
      kind="document"
      path={head.path}
      status={status}
      title={head.title}
    />
  );
}
