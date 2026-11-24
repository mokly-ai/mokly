import { defineScreen } from "@mokly/mokly";

import {
  artboardStates,
  type ArtboardViewport,
} from "../../parts/artboards.js";
import {
  explorerChangesMetadata,
  explorerState,
} from "../components/parts/metadata.js";
import { VIEW_OUTCOMES, frameOutcomes } from "../parts/frame_outcomes.js";
import { useChosenFrame } from "../parts/picked_frames.js";
import { VariantSetArtboard } from "../parts/set_stage.js";
import { CanvasShell } from "../parts/shell.js";
import { CanvasStage } from "../parts/stage.js";

import { MENU_STORIES, STORY_KEYS, storyChanges } from "./parts/branch.js";
import { EXPANDED_FRAME, ExpandedChanges } from "./parts/changes.js";
import { STORY_PAGES as S } from "./parts/destinations.js";
import { MenuInspect } from "./parts/inspect.js";
import {
  MENU_FITS,
  expandedFrames,
  expandedSideFrames,
  menuSetFrames,
} from "./parts/sketches.js";

const EXPANDED = MENU_STORIES.expanded;

/**
 * The failed Expanded story on Inspect, opened from the Changes filter: the
 * Menu's variant set, with Expanded's Light frame selected, and on a phone
 * its frame of the appearance's scheme alone. Each of Expanded's frames
 * holds the error document in its own scheme.
 */
function FailedOnInspect({ viewport }: { viewport: ArtboardViewport }) {
  const frames = menuSetFrames();
  const frame = useChosenFrame(frames, EXPANDED.slug, viewport);
  return (
    <VariantSetArtboard
      catalogue={storyChanges(STORY_KEYS.expanded, "inspect")}
      design={S.storyFailed}
      entry={EXPANDED.entry}
      fit={MENU_FITS.set}
      frames={frames}
      panel={<MenuInspect frame={frame} story={EXPANDED} />}
      selection={{ frame }}
      viewport={viewport}
    />
  );
}

/**
 * Expanded's comparison on its Changes tab, in Side by side: Before holds
 * its last render on the branch point, with the list open, and Current the
 * error document. Only Expanded's frames compare, so the stage holds their
 * pairs, and the compact frame picker picks the other pair in place.
 */
function FailedComparison({ viewport }: { viewport: ArtboardViewport }) {
  const outcomes = frameOutcomes(
    expandedFrames(),
    VIEW_OUTCOMES.variantChanged,
    { viewport },
  );
  return (
    <CanvasShell
      catalogue={storyChanges(STORY_KEYS.expanded, "changes")}
      compactZoom={MENU_FITS.pair.phone}
      design={S.storyFailedChanges}
      entry={EXPANDED.entry}
      panel={<ExpandedChanges outcomes={outcomes} />}
      tab="changes"
      viewport={viewport}
      zoom={MENU_FITS.pair.zoom}
    >
      <CanvasStage
        compare="side-by-side"
        entry={EXPANDED.entry}
        frames={expandedSideFrames()}
        pickable={expandedFrames()}
        picked={EXPANDED_FRAME}
        zoom={MENU_FITS.pair.zoom}
      />
    </CanvasShell>
  );
}

export const canvasStoryFailedScreen = defineScreen({
  ...explorerChangesMetadata,
  relatedDocs: [
    ...explorerChangesMetadata.relatedDocs,
    "docs/protocol/mokly-storybook.md",
  ],
  description:
    "The Menu's Expanded story renders its list through a portal on this branch, so it could not render. Each of its frames holds the error document that Mokly writes in place of the story: the story and its failure, the !mokly tag that leaves the story out, and then the reason. The document follows the scheme of its view, so the Dark frame shows it dark.",
  ...artboardStates(
    {
      state: "inspect",
      title: "Failed story",
      desktop: <FailedOnInspect viewport="desktop" />,
      mobile: <FailedOnInspect viewport="mobile" />,
    },
    [
      explorerState(
        "changes",
        "Failed story in Changes",
        "Expanded's comparison in Side by side: it rendered on the branch point, so Before shows its last render, with the list open, and Current shows the error document. The story reads as an ordinary changed variant.",
        (viewport) => <FailedComparison viewport={viewport} />,
      ),
    ],
  ),
  slug: "failed",
  rationale:
    "The document loaded, so the shell around it stays as it is: the Changed badge, the Changes tab, and Highlight components unavailable, because the document renders no registered component. Expanded is a changed story, so Details keep its Storybook link. Props still edits the story's args, so a reader can try args that render.",
  title: "Failed story",
});
