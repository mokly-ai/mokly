import { defineScreen } from "@mokly/mokly";

import { artboardStates } from "../../parts/artboards.js";
import type { ArtboardViewport } from "../../parts/shell.js";
import { CanvasShell } from "../parts/shell.js";
import { FITS } from "../parts/sketches.js";
import { CanvasStage } from "../parts/stage.js";

import { EVIDENCE_ENTRIES, HANDBOOK_CHANGES } from "./parts/branches.js";
import { PageChanges } from "./parts/changes.js";
import { EVIDENCE_PAGES as E } from "./parts/destinations.js";
import { PageInspect } from "./parts/inspect_entries.js";
import { evidenceMetadata, evidenceState } from "./parts/metadata.js";
import { handbookFrames } from "./parts/sketches.js";

/** The tab that a state of the changed page shows. */
type PageState = "changes" | "inspect";

/**
 * The Getting started page, which the handbook branch changed, as one
 * reading frame, with the catalogue in the Changes filter and the page
 * selected. A tab switch keeps the filter. On a phone, the panel sheet is
 * open with the state's tab.
 */
function Page({
  state,
  viewport,
}: {
  state: PageState;
  viewport: ArtboardViewport;
}) {
  const entry = EVIDENCE_ENTRIES.page;
  const changes = state === "changes";
  return (
    <CanvasShell
      catalogue={HANDBOOK_CHANGES}
      compactZoom={FITS.document}
      design={changes ? E.evidencePage : E.evidencePageInspect}
      entry={entry}
      panel={changes ? <PageChanges /> : <PageInspect />}
      sheet="panel"
      tab={state}
      viewport={viewport}
      zoom={FITS.document}
    >
      <CanvasStage
        entry={entry}
        frames={handbookFrames()}
        zoom={FITS.document}
      />
    </CanvasShell>
  );
}

export const canvasEvidencePageScreen = defineScreen({
  ...evidenceMetadata,
  description:
    "The Getting started page on a branch that changed one .action rule and the page's own stylesheet, so Changes lists the page, the Action, and its three saved variants. The page's Changes tab holds no compare modes, and its comparison details name each stylesheet once with the page's outcomes: the styles that also apply outside the changed components, the styles that apply to the page, and a change that can apply anywhere on it.",
  ...artboardStates(
    {
      state: "changes",
      title: "Changes",
      desktop: <Page state="changes" viewport="desktop" />,
      mobile: <Page state="changes" viewport="mobile" />,
    },
    [
      evidenceState(
        "inspect",
        "Inspect",
        "The page's Inspect, which holds its head alone, with Changed beside its title. On a phone, the Inspect sheet is open.",
        (viewport) => <Page state="inspect" viewport={viewport} />,
      ),
    ],
  ),
  slug: "page",
  rationale:
    "A page is read whole and never compared, so its comparison details are the only place that says why it is in Changes. Its sentences say page, so the evidence reads as a screen's does without suggesting a comparison.",
  title: "Changed page",
});
