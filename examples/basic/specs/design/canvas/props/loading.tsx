import { defineScreen } from "@mokly/mokly";

import { artboards } from "../../parts/artboards.js";
import type { ArtboardViewport } from "../../parts/shell.js";
import { actionFrames, frameOf } from "../parts/set_sketches.js";

import { PROPS_PAGES as P } from "./parts/destinations.js";
import { LoadingProps } from "./parts/forms.js";
import { ChosenVariantInspect } from "./parts/inspect.js";
import { propsDesignMetadata } from "./parts/metadata.js";
import { ChosenVariantArtboard } from "./parts/stage.js";

/**
 * The Action's variant set with Default chosen while the route's details
 * load: Default's detail and its parent's carry the declared order of the
 * fields and the usage, so Props and Usage wait without counts. The frames
 * come from the catalogue, so they show at once. While the details load, no
 * artboard shows Disabled, so it is a picture.
 */
function Loading({ viewport }: { viewport: ArtboardViewport }) {
  const frames = actionFrames();
  const frame = frameOf(frames, "default-light");
  return (
    <ChosenVariantArtboard
      design={P.propsLoading}
      frame={frame}
      frames={frames}
      panel={
        <ChosenVariantInspect
          chosen="default"
          frame={frame}
          loading
          props={{ body: <LoadingProps /> }}
          variants={{ default: P.propsLoading }}
        />
      }
      viewport={viewport}
    />
  );
}

export const canvasPropsLoadingScreen = defineScreen({
  ...propsDesignMetadata,
  description:
    "Default chosen while the route's details load: Props shows Loading props… and no fields, and Usage waits too, both without a count. The frames show at once, and Highlight components waits for the component preview.",
  ...artboards({
    desktop: <Loading viewport="desktop" />,
    mobile: <Loading viewport="mobile" />,
  }),
  slug: "loading",
  rationale:
    "Only the details carry the declared order of the fields, so the fields appear once, in that order, and never move after they show.",
  title: "Loading props",
});
