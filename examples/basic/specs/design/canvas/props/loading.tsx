import { defineScreen } from "@mokly/mokly";

import { artboardStates } from "../../parts/artboards.js";
import type { ArtboardViewport } from "../../parts/shell.js";
import { PendingProps, type PendingDetails } from "../loading/parts/details.js";
import { actionFrames, frameOf } from "../parts/set_sketches.js";

import { PROPS_PAGES as P } from "./parts/destinations.js";
import { ChosenVariantInspect } from "./parts/inspect.js";
import { propsDesignMetadata, propsState } from "./parts/metadata.js";
import { ChosenVariantArtboard } from "./parts/stage.js";

/** The route's details while they load. */
const LOADING: PendingDetails = { status: "loading" };

/** The route's details after their load failed: Try again loads them again. */
const FAILED: PendingDetails = { status: "failed", retry: P.propsLoading };

/**
 * The Action's variant set with Default chosen while the route's details
 * load, or after their load failed: the stage, Props, and Usage wait for
 * all route details. The stage holds the shipped state in place of the
 * frames, with no zoom controls, and Props and Usage wait without counts,
 * because the details carry the declared order of the fields and the usage.
 * After a failure, the stage says that the component could not be shown,
 * and it, Props, and Usage each offer Try again. While the details load or
 * failed, no artboard shows Disabled, so it is a picture.
 */
function Loading({
  details,
  viewport,
}: {
  details: PendingDetails;
  viewport: ArtboardViewport;
}) {
  const frames = actionFrames();
  const frame = frameOf(frames, "default-light");
  const design =
    details.status === "failed" ? P.propsLoadingFailed : P.propsLoading;
  return (
    <ChosenVariantArtboard
      design={design}
      details={details}
      frame={frame}
      frames={frames}
      panel={
        <ChosenVariantInspect
          chosen="default"
          details={details}
          frame={frame}
          props={{ body: <PendingProps details={details} /> }}
          variants={{ default: design }}
        />
      }
      viewport={viewport}
    />
  );
}

export const canvasPropsLoadingScreen = defineScreen({
  ...propsDesignMetadata,
  description:
    "Default chosen while the route's details load: the stage holds Loading preview… in place of the frames, Props shows Loading props… and no fields, and Usage waits too, both without a count. Highlight components waits for the component preview.",
  ...artboardStates(
    {
      state: "loading",
      title: "Loading props",
      desktop: <Loading details={LOADING} viewport="desktop" />,
      mobile: <Loading details={LOADING} viewport="mobile" />,
    },
    [
      propsState(
        "failed",
        "Props failed to load",
        "The route's details could not be loaded: the stage says that the component could not be shown, Props reads Props couldn’t be loaded. and Usage reads Usage couldn’t be loaded., and each Try again loads the details again, which opens Loading props. Highlight components keeps waiting for the component preview.",
        (viewport) => <Loading details={FAILED} viewport={viewport} />,
      ),
    ],
  ),
  slug: "loading",
  rationale:
    "Only the details carry the declared order of the fields, so the fields appear once, in that order, and never move after they show. The stage waits for the same details, so the frames and the fields arrive together.",
  title: "Loading props",
});
