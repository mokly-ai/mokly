import { defineScreen } from "@mokly/mokly";

import {
  artboardStates,
  type ArtboardViewport,
} from "../../parts/artboards.js";
import {
  explorerMetadata,
  explorerState,
} from "../components/parts/metadata.js";
import { useChosenFrame } from "../parts/picked_frames.js";
import { VariantSetArtboard } from "../parts/set_stage.js";

import {
  MENU_STORIES,
  STORY_KEYS,
  storyAll,
  storyChanges,
} from "./parts/branch.js";
import { STORY_PAGES as S } from "./parts/destinations.js";
import { MenuInspect } from "./parts/inspect.js";
import { MENU_FITS, menuSetFrames } from "./parts/sketches.js";

/**
 * The Menu's own page from All, which its first story, Collapsed, renders:
 * its variant set with no frame selected. Details name that story below the
 * stories file, and link the same story in the published Storybook.
 */
function MenuPage({ viewport }: { viewport: ArtboardViewport }) {
  return (
    <VariantSetArtboard
      catalogue={storyAll(STORY_KEYS.menu)}
      design={S.storybookLink}
      entry={MENU_STORIES.menu.entry}
      fit={MENU_FITS.set}
      frames={menuSetFrames()}
      panel={<MenuInspect story={MENU_STORIES.menu} />}
      viewport={viewport}
    />
  );
}

/**
 * The added Disabled story on Inspect, opened from the Changes filter, with
 * its Light frame selected, and on a phone its frame of the appearance's
 * scheme alone. Details name the story, with no Storybook link.
 */
function AddedStory({ viewport }: { viewport: ArtboardViewport }) {
  const frames = menuSetFrames();
  const story = MENU_STORIES.disabled;
  const frame = useChosenFrame(frames, story.slug, viewport);
  return (
    <VariantSetArtboard
      catalogue={storyChanges(STORY_KEYS.disabled, "inspect")}
      design={S.storyAdded}
      entry={story.entry}
      fit={MENU_FITS.set}
      frames={frames}
      panel={<MenuInspect frame={frame} story={story} />}
      selection={{ frame }}
      viewport={viewport}
    />
  );
}

export const canvasStorybookLinkScreen = defineScreen({
  ...explorerMetadata,
  relatedDocs: [
    ...explorerMetadata.relatedDocs,
    "docs/protocol/mokly-storybook.md",
  ],
  description:
    "The Menu's own page, which its first story, Collapsed, renders. Details name that story directly below the stories file. The configuration gives the URL of the published Storybook, so the next row links the same story there. The link opens in a new tab, and its icon and its screen-reader label say so.",
  ...artboardStates(
    {
      state: "page",
      title: "Link to Storybook",
      desktop: <MenuPage viewport="desktop" />,
      mobile: <MenuPage viewport="mobile" />,
    },
    [
      explorerState(
        "added",
        "Added story",
        "Disabled, a story that this branch adds, on Inspect from the Changes filter. The published Storybook does not hold it yet, so Details name the story without a Storybook link.",
        (viewport) => <AddedStory viewport={viewport} />,
      ),
    ],
  ),
  slug: "storybook",
  rationale:
    "Each story's page links its own story, from the story's Storybook id, and a new tab keeps the reader's place and prop edits. A link to a story that the branch adds would open a missing page, so an added entry has none. Without the URL, Details show no Storybook row.",
  title: "Link to Storybook",
});
