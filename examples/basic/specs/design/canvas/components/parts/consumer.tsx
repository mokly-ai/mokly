import type { ArtboardViewport } from "../../../parts/shell.js";
import { PreviousArtboard } from "../../outcomes/parts/removed_artboard.js";
import { REMOVED_SCREEN_RECORDS } from "../../outcomes/parts/removed_entries.js";
import {
  RemovedChanges as RemovedEntryChanges,
  RemovedScreenInspect,
} from "../../outcomes/parts/removed_panel.js";
import { farewellFrames } from "../../outcomes/parts/removed_sketches.js";
import type { PanelTab } from "../../parts/panel.js";
import { FITS } from "../../parts/sketches.js";

import { BRANCH_CHANGES, EXPLORER_KEYS, removalChanges } from "./branch.js";
import { EXPLORER_PAGES as E } from "./destinations.js";
import { CompactAction } from "./sketches.js";

const { farewell } = REMOVED_SCREEN_RECORDS;

/**
 * Farewell, which the removal branch removed with the Compact variant, as
 * its Removed state: the previous version of its two Light views, where it
 * rendered the Action with Compact's props. Compact's affected list opens it
 * on Inspect, which keeps Farewell's record and offers no Props, Usage or
 * Components; a phone shows the one frame. On its Changes tab, Farewell is
 * the first of the branch's two changes, whose Next change opens Compact's,
 * and a phone opens the panel sheet.
 */
export function ConsumerArtboard({
  tab,
  viewport,
}: {
  tab: PanelTab;
  viewport: ArtboardViewport;
}) {
  const changes = tab === "changes";
  return (
    <PreviousArtboard
      catalogue={removalChanges(EXPLORER_KEYS.farewell, tab)}
      compactZoom={FITS.phone}
      design={changes ? E.explorerConsumerChanges : E.explorerConsumer}
      frames={farewellFrames(<CompactAction />)}
      panel={
        changes ? (
          <RemovedEntryChanges
            step={{
              position: BRANCH_CHANGES.removal.farewellPosition,
              total: BRANCH_CHANGES.removal.total,
              next: E.explorerRemovedChanges,
            }}
          />
        ) : (
          <RemovedScreenInspect
            frames={{ count: 2, lightOnly: true }}
            record={farewell}
          />
        )
      }
      record={farewell}
      sheet={changes ? "panel" : undefined}
      tab={tab}
      viewport={viewport}
      zoom={FITS.profile}
    />
  );
}
