import { defineScreen } from "@mokly/mokly";

import {
  artboardStates,
  type ArtboardViewport,
} from "../../parts/artboards.js";
import { DETAILS_VIEW, detailsFrames } from "../parts/changes_sketches.js";
import { ACTION_SAVED } from "../parts/component_props.js";
import { CANVAS_ENTRIES } from "../parts/entries.js";
import { DetailsInspect } from "../parts/inspect_details.js";
import { useChosenFrame } from "../parts/picked_frames.js";
import { actionSetFrames } from "../parts/set_sketches.js";
import { CanvasShell } from "../parts/shell.js";
import { FITS } from "../parts/sketches.js";
import { CanvasStage } from "../parts/stage.js";

import { PROPS_PAGES as P } from "./parts/destinations.js";
import { PUBLISHED_COUNT, PublishedProps } from "./parts/forms.js";
import {
  ChosenVariantInspect,
  VARIANT_TITLES,
  type ChosenVariant,
} from "./parts/inspect.js";
import { propsDesignMetadata, propsState } from "./parts/metadata.js";
import { ChosenVariantArtboard } from "./parts/stage.js";

/** The artboard that shows each variant chosen in a static build. */
const PUBLISHED = {
  default: P.propsPublished,
  disabled: P.propsPublishedDisabled,
} as const satisfies Record<ChosenVariant, string>;

/**
 * The Action's variant set in a static build, with a saved variant chosen:
 * Props lists the variant's saved props read-only, and the Variants list
 * opens the other saved variant, read-only too.
 */
function Published({
  chosen,
  viewport,
}: {
  chosen: ChosenVariant;
  viewport: ArtboardViewport;
}) {
  const frames = actionSetFrames();
  const frame = useChosenFrame(frames, chosen, viewport);
  return (
    <ChosenVariantArtboard
      design={PUBLISHED[chosen]}
      frame={frame}
      frames={frames}
      panel={
        <ChosenVariantInspect
          chosen={chosen}
          frame={frame}
          props={{
            count: PUBLISHED_COUNT,
            body: (
              <PublishedProps
                title={VARIANT_TITLES[chosen]}
                values={ACTION_SAVED[chosen]}
              />
            ),
          }}
          variants={PUBLISHED}
        />
      }
      viewport={viewport}
    />
  );
}

/**
 * Details, which declares no props, with Inspect's Props section unfolded:
 * it says that the entry renders without props. On a phone, the Inspect
 * sheet holds the unfolded section.
 */
function NoProps({ viewport }: { viewport: ArtboardViewport }) {
  const entry = CANVAS_ENTRIES.details;
  return (
    <CanvasShell
      catalogue={{ filter: "all", activeKey: "details" }}
      compactZoom={FITS.phone}
      design={P.propsNoProps}
      entry={entry}
      panel={<DetailsInspect initial="props" open={["props"]} />}
      sheet="panel"
      viewport={viewport}
      zoom={FITS.welcome}
    >
      <CanvasStage
        entry={entry}
        frames={detailsFrames()}
        view={DETAILS_VIEW}
        zoom={FITS.welcome}
      />
    </CanvasShell>
  );
}

export const canvasPropsReadOnlyScreen = defineScreen({
  ...propsDesignMetadata,
  description:
    "A static build shows saved props without fields: Props lists Default's saved props read-only and says where to edit them. The Variants list still opens each saved variant, read-only too.",
  ...artboardStates(
    {
      state: "published",
      title: "Static build",
      desktop: <Published chosen="default" viewport="desktop" />,
      mobile: <Published chosen="default" viewport="mobile" />,
    },
    [
      propsState(
        "disabled",
        "Static build, Disabled chosen",
        "Disabled chosen in a static build: its saved props stay read-only, its unset hint reads Not set, and Default in Variants returns to Default's saved props.",
        (viewport) => <Published chosen="disabled" viewport={viewport} />,
      ),
      propsState(
        "no-props",
        "Screen without props",
        "Details declares no props, so its Props section says that it renders without props instead of showing fields. On a phone, the Inspect sheet holds the unfolded section.",
        (viewport) => <NoProps viewport={viewport} />,
      ),
    ],
  ),
  slug: "read-only",
  rationale:
    "Saved props stay readable where they cannot be edited, so a reader still compares variants in a static build; the one secondary line says where editing works.",
  title: "Read-only props",
});
