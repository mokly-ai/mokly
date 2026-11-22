import type { ReactNode } from "react";

import { StateDot } from "../components/controls";
import { Icon } from "../components/icons";
import { WaitingDot } from "../components/placeholder-rows";

import type { PublicationState } from "./resolution";
import { publicationTones } from "./resolution";

/** The kind of reference a pill names, which its leading glyph shows. */
export type ReferenceKind = "branch" | "pullRequest";

/** The size of the pill's glyphs, in px: its leading glyph and its chevron. */
const glyphSize = 14;

/**
 * The publication pill, as the catalogue draws it: one rounded control on the
 * muted surface with a hairline, around the reference trigger and what the
 * stage shows of it. The trigger keeps the reference as its own label, so the
 * glyph, the dot, the state and the chevron around it are decorative. While
 * nothing names the reference, the pill holds the trigger's placeholder,
 * which takes the muted surface itself, so the pill takes the bar's surface.
 */
export function PublicationPill({
  waiting = false,
  children,
}: {
  waiting?: boolean;
  children: ReactNode;
}) {
  return (
    <span
      className={
        waiting ? "fo-canvas-pill fo-canvas-pill-waiting" : "fo-canvas-pill"
      }
    >
      {children}
    </span>
  );
}

/** The pill's leading glyph: the branch or the pull request icon. */
export function PillGlyph({ kind }: { kind: ReferenceKind }) {
  return (
    <span className="fo-canvas-pill-glyph">
      <Icon name={kind} size={glyphSize} />
    </span>
  );
}

/**
 * The compact pill's status dot, which stands for the state that the compact
 * pill leaves out, or its placeholder while a read decides that state.
 */
export function PillDot({ state }: { state?: PublicationState }) {
  return (
    <span className="fo-canvas-pill-dot">
      {state === undefined ? (
        <WaitingDot />
      ) : (
        <StateDot tone={publicationTones[state]} />
      )}
    </span>
  );
}

/** The chevron at the end of the full pill, the switcher's glyph. */
export function PillChevron() {
  return (
    <span className="fo-canvas-pill-chevron">
      <Icon name="switcher" size={glyphSize} />
    </span>
  );
}
