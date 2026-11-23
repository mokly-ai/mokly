import { defineScreen } from "@mokly/mokly";

import { artboardStates } from "../../parts/artboards.js";
import type { ArtboardViewport } from "../../parts/shell.js";
import {
  COMPARISON_VIEW,
  type CompareFrame,
} from "../parts/changes_sketches.js";
import { CANVAS_ENTRIES } from "../parts/entries.js";
import { useOpeningFrame } from "../parts/picked_frames.js";
import { CanvasShell } from "../parts/shell.js";
import { FITS } from "../parts/sketches.js";
import { CanvasStage } from "../parts/stage.js";

import { STYLES_CHANGES, stylesAll } from "./parts/branches.js";
import { StylesChanges, type StylesMode } from "./parts/changes.js";
import {
  EVIDENCE_PAGES as E,
  type EvidenceDestination,
} from "./parts/destinations.js";
import {
  MATCHED_STYLES,
  UNNAMED_STYLES,
  UNRESOLVED_STYLES,
  type EvidenceFacts,
} from "./parts/evidence.js";
import { evidenceMetadata, evidenceState } from "./parts/metadata.js";
import {
  PLAIN_WELCOME_VIEW,
  styledWelcomeFrames,
  styledWelcomePairs,
} from "./parts/sketches.js";

/** A state of Welcome's stylesheet evidence, by its saved state's slug. */
type StylesState = "excluded" | "matched" | "unnamed" | "unresolved";

/** The artboard, the evidence, and the compare mode of each state. */
const STATES = {
  matched: {
    design: E.evidenceStyles,
    facts: MATCHED_STYLES,
    mode: "side-by-side",
  },
  unresolved: {
    design: E.evidenceStylesUnresolved,
    facts: UNRESOLVED_STYLES,
    mode: "side-by-side",
  },
  unnamed: {
    design: E.evidenceStylesUnnamed,
    facts: UNNAMED_STYLES,
    mode: "side-by-side",
  },
  excluded: {
    design: E.evidenceStylesExcluded,
    facts: MATCHED_STYLES,
    mode: "current",
  },
} as const satisfies Record<
  StylesState,
  { design: EvidenceDestination; facts: EvidenceFacts; mode: StylesMode }
>;

/**
 * Welcome, which a changed stylesheet keeps in Changes, on its Changes tab:
 * in Side by side with the catalogue in the Changes filter, where Welcome is
 * the one change, or in Current with the catalogue in All. Side by side
 * compares Desktop · Light on a desktop and, on a phone, the frame that the
 * phone opens on. A comparison cannot be highlighted; Current can. On a
 * phone, the Changes sheet is open at the comparison details.
 */
function Styles({
  state,
  viewport,
}: {
  state: StylesState;
  viewport: ArtboardViewport;
}) {
  const { design, facts, mode } = STATES[state];
  const entry = CANVAS_ENTRIES.welcome;
  const side = mode === "side-by-side";
  const opening = useOpeningFrame(styledWelcomeFrames());
  const frame: CompareFrame =
    viewport === "desktop" ? "desktop-light" : opening;
  const zoom = side ? FITS.sideBySide : FITS.welcome;
  return (
    <CanvasShell
      catalogue={side ? STYLES_CHANGES : stylesAll("welcome")}
      compactZoom={side ? FITS.phoneSide : FITS.phone}
      design={design}
      entry={entry}
      panel={
        <StylesChanges
          design={design}
          facts={facts}
          frame={side ? frame : undefined}
          mode={mode}
        />
      }
      sheet="panel"
      tab="changes"
      viewport={viewport}
      zoom={zoom}
    >
      <CanvasStage
        compare={mode}
        entry={entry}
        frames={side ? styledWelcomePairs() : styledWelcomeFrames()}
        pickable={side ? styledWelcomeFrames() : undefined}
        picked={frame}
        view={side ? COMPARISON_VIEW : PLAIN_WELCOME_VIEW}
        zoom={zoom}
      />
    </CanvasShell>
  );
}

/** A saved state of the stylesheet evidence, with its artboards. */
function stylesState(
  state: Exclude<StylesState, "matched">,
  title: string,
  description: string,
  rationale: string,
) {
  return {
    ...evidenceState(state, title, description, (viewport) => (
      <Styles state={state} viewport={viewport} />
    )),
    rationale,
  };
}

export const canvasEvidenceStylesScreen = defineScreen({
  ...evidenceMetadata,
  description:
    "Welcome on a branch that changed two linked stylesheets: generated/styles.css, whose changed styles apply to Welcome, and generated/excluded.css, whose changed styles apply to neither Welcome nor Details. Changes lists Welcome alone, which compares Desktop · Light in Side by side. Its comparison details name the changed stylesheet once, with the styles that apply to Welcome under it, then list the other stylesheet as examined and excluded. On a phone, the Changes sheet opens at the comparison details.",
  ...artboardStates(
    {
      state: "matched",
      title: "Matched styles",
      desktop: <Styles state="matched" viewport="desktop" />,
      mobile: <Styles state="matched" viewport="mobile" />,
    },
    [
      stylesState(
        "unresolved",
        "Unresolved styles",
        "Welcome on a branch that changed generated/styles.css in a way that can apply anywhere on the screen. Welcome stays in Changes, in Side by side, and its comparison details name the stylesheet with the style that the change can reach.",
        "No match proves where the change applies, so the details do not call it a match: they say that it can apply anywhere, and that this keeps the screen in Changes.",
      ),
      stylesState(
        "unnamed",
        "Unnamed styles",
        "The same reach on a branch whose changed rule names no style, such as a font or an animation rule. The sentence ends with a full stop, and no list follows it.",
        "A changed rule without a style name still keeps the screen in Changes, with nothing to list, so the same sentence carries both cases and only its last mark differs.",
      ),
      stylesState(
        "excluded",
        "Excluded styles",
        "The branch of Matched styles with the catalogue in All, where Welcome carries the changed mark and Details carries none. Welcome's Changes tab starts in Current and shows the same comparison details as Side by side. The Details row opens Details, which links only the excluded stylesheet.",
        "An excluded stylesheet never removes the changes that another stylesheet causes, so Welcome keeps its status and its comparison. Current shows the same files and sentences as a loaded comparison.",
      ),
    ],
  ),
  slug: "styles",
  rationale:
    "Each changed file leads its own item with its outcomes under it, so no list mixes two stylesheets, and an examined stylesheet stays visible without adding a change.",
  title: "Changed styles",
});
