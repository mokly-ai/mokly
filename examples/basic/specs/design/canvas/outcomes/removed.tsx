import { defineScreen } from "@mokly/mokly";

import { artboardStates } from "../../parts/artboards.js";
import type { ArtboardViewport } from "../../parts/shell.js";
import { screenFrames } from "../parts/frames.js";
import type { PanelTab } from "../parts/panel.js";
import { FITS } from "../parts/sketches.js";

import { OUTCOME_PAGES as O } from "./parts/destinations.js";
import { removedMetadata, removedState } from "./parts/metadata.js";
import { PendingArtboard, PreviousArtboard } from "./parts/removed_artboard.js";
import { CANONICAL_STEPS, canonicalRemoved } from "./parts/removed_branches.js";
import { REMOVED_SCREEN_RECORDS as R } from "./parts/removed_entries.js";
import { RemovedChanges, RemovedScreenInspect } from "./parts/removed_panel.js";
import {
  MissingView,
  farewellFrames,
  surveyFrames,
  timelineFrames,
} from "./parts/removed_sketches.js";

/**
 * A removed screen's views are Light only, so its section holds the Light
 * row alone, Desktop beside Mobile, which fits at the zoom of Profile's.
 */
const LIGHT_ROW = { count: 2, lightOnly: true } as const;

/**
 * Farewell, which the canonical branch removed, selected from the Changes
 * filter: its previous version on its two Light frames. On the Changes tab,
 * the rail holds the version before alone, no compare mode shows, and a
 * phone shows the one frame. Inspect keeps the record of the branch point,
 * and a phone opens it in the panel sheet.
 */
function Farewell({
  tab,
  viewport,
}: {
  tab: PanelTab;
  viewport: ArtboardViewport;
}) {
  const inspect = tab === "inspect";
  return (
    <PreviousArtboard
      catalogue={canonicalRemoved(R.farewell, tab)}
      compactZoom={FITS.phone}
      design={inspect ? O.removedInspect : O.removed}
      frames={farewellFrames()}
      panel={
        inspect ? (
          <RemovedScreenInspect frames={LIGHT_ROW} record={R.farewell} />
        ) : (
          <RemovedChanges step={CANONICAL_STEPS.farewell} />
        )
      }
      record={R.farewell}
      sheet={inspect ? "panel" : undefined}
      tab={tab}
      viewport={viewport}
      zoom={FITS.profile}
    />
  );
}

/**
 * The Survey, a screen taller than its frames: each frame shows its top,
 * and the document scrolls inside the frame, as its scrollbar's thumb shows.
 */
function Survey({ viewport }: { viewport: ArtboardViewport }) {
  return (
    <PreviousArtboard
      catalogue={canonicalRemoved(R.survey, "changes")}
      compactZoom={FITS.phone}
      design={O.removedLong}
      frames={surveyFrames()}
      panel={<RemovedChanges step={CANONICAL_STEPS.survey} />}
      record={R.survey}
      tab="changes"
      viewport={viewport}
      zoom={FITS.profile}
    />
  );
}

/**
 * Invite while its previous version loads, and Archive after its request
 * failed, whose Retry opens the loading state. The compact frame picker
 * lists the views that the catalogue index names.
 */
function Pending({
  failed,
  viewport,
}: {
  failed: boolean;
  viewport: ArtboardViewport;
}) {
  const record = failed ? R.archive : R.invite;
  return (
    <PendingArtboard
      catalogue={canonicalRemoved(record, "changes")}
      design={failed ? O.removedUnavailable : O.removedLoading}
      frames={screenFrames(() => null, ["light"])}
      panel={
        <RemovedChanges
          step={failed ? CANONICAL_STEPS.archive : CANONICAL_STEPS.invite}
        />
      }
      record={record}
      request={
        failed
          ? { status: "failed", retry: O.removedLoading }
          : { status: "loading" }
      }
      tab="changes"
      viewport={viewport}
    />
  );
}

/**
 * Timeline, which was only ever drawn at desktop width, on Inspect: its
 * Desktop · Light frame, and in the place of its Mobile · Light frame the
 * note that no previous mobile version was captured. The note's second
 * sentence names Desktop, so it shows only while no Desktop frame shows:
 * once the Frames filter hides Desktop, and on a phone, which shows one
 * frame.
 */
function NoView({ viewport }: { viewport: ArtboardViewport }) {
  return (
    <PreviousArtboard
      catalogue={canonicalRemoved(R.timeline, "inspect")}
      compactZoom={FITS.phone}
      design={O.removedNoView}
      frames={timelineFrames()}
      overlays={{ "mobile-light": <MissingView viewport="mobile" /> }}
      panel={<RemovedScreenInspect frames={LIGHT_ROW} record={R.timeline} />}
      record={R.timeline}
      tab="inspect"
      viewport={viewport}
      zoom={FITS.profile}
    />
  );
}

export const canvasRemovedScreen = defineScreen({
  ...removedMetadata,
  description:
    "Farewell, which the branch removed, opens as a section of its historical views: one frame for each view, with the Removed status and Showing previous version in the section head. Its Changes tab holds the version before alone and the comparison details, and offers no compare mode.",
  ...artboardStates(
    {
      state: "changes",
      title: "Changes",
      desktop: <Farewell tab="changes" viewport="desktop" />,
      mobile: <Farewell tab="changes" viewport="mobile" />,
    },
    [
      removedState(
        "inspect",
        "Inspect",
        "Farewell's Inspect keeps the record of the branch point: its description, path, source, schemes and folders. Highlight components is unavailable, and no Selection, Props, Usage or Components section shows. On a phone, the panel sheet is open.",
        (viewport) => <Farewell tab="inspect" viewport={viewport} />,
      ),
      removedState(
        "long",
        "Long screen",
        "The Survey, a screen taller than its frames, scrolls inside each frame instead of being cropped to it.",
        (viewport) => <Survey viewport={viewport} />,
      ),
      removedState(
        "loading",
        "Loading",
        "Invite while its previous version loads: the canvas holds the status line in place of the section, so neither the zoom pill nor the dock's Fit shows.",
        (viewport) => <Pending failed={false} viewport={viewport} />,
      ),
      removedState(
        "unavailable",
        "Unavailable",
        "Archive after its previous version could not be loaded: the canvas says so, and Retry repeats the request. Current output never stands in for the missing history.",
        (viewport) => <Pending failed viewport={viewport} />,
      ),
      removedState(
        "no-view",
        "No mobile view",
        "Timeline was only ever drawn at desktop width, so the place of its mobile frame holds the note. Its second sentence shows only while no Desktop frame shows, as on a phone or with Desktop hidden.",
        (viewport) => <NoView viewport={viewport} />,
      ),
    ],
  ),
  slug: "removed",
  rationale:
    "A removed screen has nothing current to compare, so it opens as every other screen does, as its frames on the canvas, and the section head says that they show the previous version.",
  title: "Removed screen",
});
