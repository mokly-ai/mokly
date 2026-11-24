import type { ReactNode } from "react";

import { CANVAS_PAGES } from "../canvas/parts/destinations.js";
import { HighlightLayer } from "../components/parts/highlight.js";

import { DesignLink } from "./design_navigation.js";
import { MiniInstances, type MiniForm } from "./mini_views.js";

interface MiniScreenProps {
  compact?: boolean;
  /** Shown inside a comparison, where links do nothing, so it carries none. */
  inert?: boolean;
  restyled?: boolean;
  revised?: boolean;
}

/**
 * Welcome's link to Details' Canvas artboard, which a comparison draws inert.
 */
function WelcomeLink({ inert }: { inert?: boolean | undefined }) {
  return (
    <DesignLink to={inert ? undefined : CANVAS_PAGES.added}>
      <span className="mbk-shot-link">Open the details screen</span>
    </DesignLink>
  );
}

/** Welcome's heading and the revision's new introduction. */
function WelcomeHeading({ revised }: { revised?: boolean | undefined }) {
  return (
    <>
      <h2>{revised ? "Welcome to the Mokly example" : "Welcome to Mokly"}</h2>
      {revised ? <p>A short introduction now welcomes new readers.</p> : null}
    </>
  );
}

/**
 * A mini screen's sheet: the screen's surface, which a phone marks compact,
 * and the highlight of the depicted view over it.
 */
function Shot({
  children,
  compact,
  restyled,
}: {
  children: ReactNode;
  compact?: boolean | undefined;
  restyled?: boolean | undefined;
}) {
  const flags = `${compact ? " mbk-shot--compact" : ""}${restyled ? " mbk-shot--restyled" : ""}`;
  return (
    <div className={`mbk-shot${flags}`}>
      <div className="mbk-shot-pad">{children}</div>
      <HighlightLayer viewport={compact ? "mobile" : "desktop"} />
    </div>
  );
}

/**
 * Miniature depiction of the example Welcome fragment, with the Action and
 * the Toolbar that the real screen renders.
 */
export function MiniWelcome({
  compact,
  inert,
  restyled,
  revised,
}: MiniScreenProps) {
  const form: MiniForm = revised ? "welcome-revised" : "welcome";
  return (
    <Shot compact={compact} restyled={restyled}>
      <div className="mbk-shot-nav">
        {compact ? "Menu" : "Example navigation"}
      </div>
      <WelcomeHeading revised={revised} />
      <MiniInstances form={form} link={<WelcomeLink inert={inert} />} />
    </Shot>
  );
}

/**
 * Miniature depiction of the example Details fragment, with the Action and
 * the Toolbar that the real screen renders. An inert Details carries no link,
 * as on the canvas of another design family.
 */
export function MiniDetails({ compact, inert }: MiniScreenProps) {
  return (
    <Shot compact={compact}>
      <h2>{compact ? "Details" : "Example catalogue details"}</h2>
      <p className="mbk-shot-text">
        This screen is synthetic and belongs only to the package example.
      </p>
      <MiniInstances
        form="details"
        link={
          <DesignLink to={inert ? undefined : CANVAS_PAGES.overview}>
            <span className="mbk-shot-link">Return to welcome</span>
          </DesignLink>
        }
      />
    </Shot>
  );
}
