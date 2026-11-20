import { defineScreen } from "@mokly/mokly";

import { useRenderedAppearance } from "../../parts/appearance.js";
import { artboards } from "../../parts/artboards.js";
import type { ArtboardViewport } from "../../parts/shell.js";
import { CANVAS_PAGES } from "../parts/destinations.js";
import { CANVAS_ENTRIES } from "../parts/entries.js";
import { PaymentTermsInspect } from "../parts/inspect_entries.js";
import { canvasDesignMetadata } from "../parts/metadata.js";
import { CanvasShell } from "../parts/shell.js";
import { FITS, paymentTermsFrames } from "../parts/sketches.js";
import { CanvasStage } from "../parts/stage.js";

/**
 * The Payment terms document as one reading frame. It moved under Account
 * on the canonical branch, so its panel also has Changes.
 */
function Document({ viewport }: { viewport: ArtboardViewport }) {
  const entry = CANVAS_ENTRIES.paymentTerms;
  return (
    <CanvasShell
      catalogue={{ filter: "all", activeKey: "payment-terms" }}
      compactZoom={FITS.document}
      design={CANVAS_PAGES.document}
      entry={entry}
      panel={<PaymentTermsInspect />}
      viewport={viewport}
      zoom={FITS.document}
    >
      <CanvasStage
        entry={entry}
        frames={paymentTermsFrames(useRenderedAppearance())}
        zoom={FITS.document}
      />
    </CanvasShell>
  );
}

export const canvasDocumentScreen = defineScreen({
  ...canvasDesignMetadata,
  description:
    "A Markdown document opens as one reading frame in the catalogue's own type, instead of four device frames. On a phone, the frame takes the canvas width and the text reflows.",
  ...artboards({
    desktop: <Document viewport="desktop" />,
    mobile: <Document viewport="mobile" />,
  }),
  slug: "document",
  title: "Document",
});
