import { defineScreen } from "@mokly/mokly";

import { useRenderedAppearance } from "../../parts/appearance.js";
import {
  artboardStates,
  type ArtboardViewport,
} from "../../parts/artboards.js";
import { CANVAS_PAGES } from "../parts/destinations.js";
import { CANVAS_ENTRIES } from "../parts/entries.js";
import { PaymentTermsInspect } from "../parts/inspect_entries.js";
import { canvasDesignMetadata } from "../parts/metadata.js";
import { CanvasShell } from "../parts/shell.js";
import { FITS, paymentTermsFrames } from "../parts/sketches.js";
import { CanvasStage } from "../parts/stage.js";

import {
  LIGHT_ONLY_CATALOGUE,
  LIGHT_ONLY_TERMS,
  LightOnlyTermsInspect,
  lightOnlyTermsFrames,
} from "./parts/light_only.js";

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

/**
 * Payment terms on the light-only branch, whose catalogue renders Light only
 * now: its reading frame keeps the light page in both appearances, and under
 * Dark its label names that fallback.
 */
function LightOnlyDocument({ viewport }: { viewport: ArtboardViewport }) {
  return (
    <CanvasShell
      catalogue={LIGHT_ONLY_CATALOGUE}
      compactZoom={FITS.document}
      design={CANVAS_PAGES.documentLightOnly}
      entry={LIGHT_ONLY_TERMS}
      panel={<LightOnlyTermsInspect />}
      viewport={viewport}
      zoom={FITS.document}
    >
      <CanvasStage
        entry={LIGHT_ONLY_TERMS}
        frames={lightOnlyTermsFrames(useRenderedAppearance() === "dark")}
        zoom={FITS.document}
      />
    </CanvasShell>
  );
}

export const canvasDocumentScreen = defineScreen({
  ...canvasDesignMetadata,
  description:
    "A Markdown document opens as one reading frame in the catalogue's own type, instead of four device frames. On a phone, the frame takes the canvas width and the text reflows.",
  ...artboardStates(
    {
      state: "document",
      title: "Document",
      desktop: <Document viewport="desktop" />,
      mobile: <Document viewport="mobile" />,
    },
    [
      {
        colorSchemes: canvasDesignMetadata.colorSchemes,
        description:
          "Payment terms on a branch whose catalogue rendered Light and Dark at the branch point and renders Light only now, and which removed the Action's Compact variant. Compact's previous version keeps its dark render, so the shell still offers Dark, while Payment terms has a light page only. Under Dark, its reading frame keeps that page, and its label reads payment-terms.md · Light only.",
        desktop: <LightOnlyDocument viewport="desktop" />,
        mobile: <LightOnlyDocument viewport="mobile" />,
        rationale:
          "A reader who chose Dark should not take a light page for a missing dark style, so the frame that falls back says so in its own label.",
        slug: "light-only",
        title: "Light only",
      },
    ],
  ),
  slug: "document",
  title: "Document",
});
