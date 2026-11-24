import type { ArtboardViewport } from "../../../parts/artboards.js";
import type { CatalogueTag } from "../../../parts/tags.js";
import { CANVAS_ENTRIES } from "../../parts/entries.js";
import { WelcomeInspect } from "../../parts/inspect_welcome.js";
import { CanvasShell } from "../../parts/shell.js";
import { FITS, WELCOME_VIEW, welcomeFrames } from "../../parts/sketches.js";
import { CanvasStage } from "../../parts/stage.js";

import { taggedRows } from "./tagged_rows.js";
import { tagFilterPage } from "./tags.js";

/**
 * Welcome on the overview while its search enters a tag or opens the tag
 * picker: the top bar's field holds `tag:<tag>`, the picker under it marks
 * that tag's chip, the catalogue in All keeps only the rows that match, and
 * Inspect's Tags row reads the same tag. Without a tag, the field is empty
 * and the catalogue whole. On a phone, an open picker drops as a sheet
 * under the bar, and no other sheet opens.
 */
export function TagSearchArtboard({
  active,
  picker,
  viewport,
}: {
  active?: CatalogueTag | undefined;
  picker: boolean;
  viewport: ArtboardViewport;
}) {
  const entry = CANVAS_ENTRIES.welcome;
  return (
    <CanvasShell
      catalogue={{
        filter: "all",
        activeKey: "welcome",
        rows: active === undefined ? undefined : taggedRows(active),
      }}
      compactZoom={FITS.phone}
      design={tagFilterPage(active, picker)}
      entry={entry}
      panel={<WelcomeInspect activeTag={active} />}
      search={{
        value: active === undefined ? undefined : `tag:${active}`,
        activeTag: active,
        pickerOpen: picker,
      }}
      viewport={viewport}
      zoom={FITS.welcome}
    >
      <CanvasStage
        entry={entry}
        frames={welcomeFrames()}
        view={WELCOME_VIEW}
        zoom={FITS.welcome}
      />
    </CanvasShell>
  );
}
