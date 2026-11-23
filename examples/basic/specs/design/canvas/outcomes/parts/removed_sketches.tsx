import type { CSSProperties, ReactNode } from "react";

import { PreviewNotCaptured } from "../../../../../../../packages/ui/src/preview-state/preview-state.js";
import { ExampleDocument } from "../../../../document.js";
import { canvasScope } from "../../../parts/canvas_palette.js";
import { RemovedFieldGuide } from "../../../parts/removed_documents.js";
import {
  MiniFarewell,
  MiniSaveFailed,
  MiniSurvey,
  MiniTimeline,
} from "../../../parts/removed_shots.js";
import type { ArtboardViewport } from "../../../parts/shell.js";
import { PaymentTerms } from "../../../parts/spec_documents.js";
import { readingFrame, screenFrames } from "../../parts/frames.js";

import { HANDBOOK_FILE } from "./removed_entries.js";

/**
 * A document taller than its frame, drawn at its top: the frame clips it,
 * and the thumb of its own scrollbar, at the given share of the track,
 * shows how much more it holds below.
 */
function Scrolled({
  children,
  thumb,
}: {
  children: ReactNode;
  /** The share of the document that the frame shows, in percent. */
  thumb: number;
}) {
  const style: CSSProperties & Record<"--cv-rm-thumb", string> = {
    "--cv-rm-thumb": `${thumb}%`,
  };
  return (
    <div className="cv-rm-scrolled" style={style}>
      {children}
      <span aria-hidden="true" className="cv-rm-thumb" />
    </div>
  );
}

/**
 * Farewell's previous version on its Light frames, the only scheme that its
 * views were captured in. On a branch where Farewell rendered a component,
 * its picture follows the text.
 */
export function farewellFrames(component?: ReactNode) {
  return screenFrames(
    (viewport) => (
      <MiniFarewell compact={viewport === "mobile"}>{component}</MiniFarewell>
    ),
    ["light"],
  );
}

/**
 * The share of the Survey that each frame shows: its six questions with
 * their answer fields, 1,177px in all, run past the frame, whose height the
 * rows fix.
 */
const SURVEY_THUMBS = { desktop: 68, mobile: 72 } as const;

/** The Survey's previous version, a tall screen that scrolls in its frames. */
export function surveyFrames() {
  return screenFrames(
    (viewport) => (
      <Scrolled thumb={SURVEY_THUMBS[viewport]}>
        <MiniSurvey answers compact={viewport === "mobile"} />
      </Scrolled>
    ),
    ["light"],
  );
}

/**
 * Timeline's previous version: its desktop view, and, where its mobile frame
 * would stand, the frame-sized place of a view that was never captured,
 * which holds the note that `MissingView` draws over it.
 */
export function timelineFrames() {
  return screenFrames(
    (viewport) =>
      viewport === "desktop" ? (
        <MiniTimeline />
      ) : (
        <span aria-hidden="true" className="cv-rm-place" />
      ),
    ["light"],
  );
}

/**
 * The note in the place of a viewport without a previous view, in the
 * shell's words, unscaled over the place so it reads at every zoom. Its
 * second sentence names the other viewport, so it shows only while no frame
 * of that viewport shows.
 */
export function MissingView({ viewport }: { viewport: ArtboardViewport }) {
  return (
    <div className="cv-rm-missing" data-cv-missing={viewport}>
      <PreviewNotCaptured viewport={viewport} />
    </div>
  );
}

/** Welcome's removed Save failed variant, in both schemes and viewports. */
export function saveFailedFrames() {
  return screenFrames((viewport) => (
    <MiniSaveFailed compact={viewport === "mobile"} />
  ));
}

/**
 * A removed page's one reading frame, named by its source file. A page is
 * light only, so the frame keeps the page's light document in both
 * appearances; its links are pictures, as in every previous version.
 */
export function handbookFrames() {
  return [
    readingFrame(
      HANDBOOK_FILE,
      <ExampleDocument readOnly />,
      { width: 760, height: 420 },
      "light",
    ),
  ];
}

/**
 * The share of the Field guide that its 620px reading frame shows: 1,058px
 * at the desktop frame's width, and 1,448px once a phone's frame reflows it
 * to the canvas width.
 */
const FIELD_GUIDE_THUMBS = { desktop: 59, mobile: 43 } as const;

/** The Field guide's previous version, a long page that scrolls in its frame. */
export function fieldGuideFrames(viewport: ArtboardViewport) {
  return [
    readingFrame(
      HANDBOOK_FILE,
      <Scrolled thumb={FIELD_GUIDE_THUMBS[viewport]}>
        <RemovedFieldGuide />
      </Scrolled>,
      { width: 760, height: 620 },
      "light",
    ),
  ];
}

/**
 * The removed Payment terms document as one reading frame. Its previous
 * version has a light render only, so the frame keeps the Light palette of
 * Mokly's Markdown typography in both appearances.
 */
export function lightOnlyFrames() {
  return [
    readingFrame(
      "payment-terms.md",
      <div {...canvasScope("light")} data-cv-light-only="">
        <div className="mbk-markdown">
          <article className="mbk-markdown-body">
            <PaymentTerms />
          </article>
        </div>
      </div>,
      { width: 760, height: 620 },
      "light",
    ),
  ];
}
