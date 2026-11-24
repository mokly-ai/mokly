import { defineScreen } from "@mokly/mokly";

import { artboards, type ArtboardViewport } from "../../parts/artboards.js";
import { CanvasShell } from "../parts/shell.js";
import { FITS } from "../parts/sketches.js";
import { CanvasStage } from "../parts/stage.js";

import { EVIDENCE_ENTRIES, quietAll } from "./parts/branches.js";
import { EVIDENCE_PAGES as E } from "./parts/destinations.js";
import { IgnoredInspect } from "./parts/inspect.js";
import { evidenceMetadata } from "./parts/metadata.js";
import { PLAIN_WELCOME_VIEW, plainWelcomeFrames } from "./parts/sketches.js";

/**
 * Welcome, whose only differences lie in its navigation, which the
 * comparison leaves out: it stays out of Changes, names no status, and its
 * right panel has Inspect alone, which keeps the evidence after the head.
 * The frames show the current version. On a phone, the Inspect sheet is open
 * at its expanded height.
 */
function Ignored({ viewport }: { viewport: ArtboardViewport }) {
  const entry = EVIDENCE_ENTRIES.welcome;
  return (
    <CanvasShell
      catalogue={quietAll("welcome")}
      compactZoom={FITS.phone}
      design={E.evidenceIgnored}
      entry={entry}
      expanded
      panel={<IgnoredInspect />}
      sheet="panel"
      viewport={viewport}
      zoom={FITS.welcome}
    >
      <CanvasStage
        entry={entry}
        frames={plainWelcomeFrames()}
        view={PLAIN_WELCOME_VIEW}
        zoom={FITS.welcome}
      />
    </CanvasShell>
  );
}

export const canvasEvidenceIgnoredScreen = defineScreen({
  ...evidenceMetadata,
  description:
    "Welcome on a branch that changed only the content of its navigation, which the example excludes from comparisons, so Changes lists nothing. Welcome offers no comparison and shows its current version. Inspect keeps the evidence after the head: the excluded content, then “No changes to this screen.”",
  ...artboards({
    desktop: <Ignored viewport="desktop" />,
    mobile: <Ignored viewport="mobile" />,
  }),
  slug: "ignored",
  rationale:
    "A difference inside excluded content never lists an entry or offers a comparison, but the evidence still names that content, so a reader can see why the screen stays unchanged.",
  title: "Excluded content only",
});
