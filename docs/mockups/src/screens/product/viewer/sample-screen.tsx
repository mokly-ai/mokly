import { paletteColors } from "@mokly-cloud/tokens/palettes";
import type { CSSProperties } from "react";

import type { ColorScheme, Viewport } from "@mokly/mokly";

import {
  currentScreen,
  sampleScreen,
} from "../../../fixtures/viewer-catalogue";

/**
 * The custom properties through which `viewer-depiction.css` paints the
 * sample.
 */
type SamplePalette = CSSProperties &
  Record<
    | "--fo-sample-surface"
    | "--fo-sample-fill"
    | "--fo-sample-ink"
    | "--fo-sample-ink-muted"
    | "--fo-sample-line",
    string
  >;

/**
 * The Canvas palette of the shown view's scheme, which the viewer documents
 * bind, read from the shared tokens. A frame can show a light view in a dark
 * document, so the sample does not read the document's own palette.
 */
function samplePalette(scheme: ColorScheme): SamplePalette {
  const color = paletteColors(scheme, "canvas");
  return {
    "--fo-sample-surface": color.surface,
    "--fo-sample-fill": color.surfaceMuted,
    "--fo-sample-ink": color.text,
    "--fo-sample-ink-muted": color.textMuted,
    "--fo-sample-line": color.border,
  };
}

/**
 * The publication's current screen inside a device frame: a sample of the
 * page that the frame would load, laid out for the frame's own viewport and
 * painted in the scheme of the view that the frame shows. It is one picture,
 * so its title and links stay out of the drawing's outline, as a framed
 * document's would.
 */
export function SampleScreen({
  viewport,
  scheme,
}: {
  viewport: Viewport;
  scheme: ColorScheme;
}) {
  const cards = Array.from(
    { length: sampleScreen.cards[viewport] },
    (_, index) => index,
  );
  return (
    <div
      className={"fo-sample-screen fo-sample-" + viewport}
      role="img"
      aria-label={sampleScreen.title + " screen"}
      data-mkc-sample-screen={currentScreen.path}
      style={samplePalette(scheme)}
    >
      <div className="fo-sample-bar">
        <span className="fo-sample-brand">
          <span className="fo-sample-mark" />
          {sampleScreen.brand}
        </span>
        {viewport === "desktop" ? (
          <span className="fo-sample-links">
            {sampleScreen.links.map((link) => (
              <span key={link}>{link}</span>
            ))}
          </span>
        ) : (
          <span className="fo-sample-menu" />
        )}
      </div>
      <div className="fo-sample-hero">
        <span className="fo-sample-title">{sampleScreen.title}</span>
        <span className="fo-sample-line" />
        <span className="fo-sample-line fo-sample-line-short" />
        <span className="fo-sample-action" />
      </div>
      <div className="fo-sample-cards">
        {cards.map((card) => (
          <span className="fo-sample-card" key={card} />
        ))}
      </div>
    </div>
  );
}
