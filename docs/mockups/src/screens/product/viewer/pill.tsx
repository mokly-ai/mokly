import type { ReactNode } from "react";

import { StatusDot } from "../../../entries/design/status-dot.mockup";
import type { PublicationState } from "../../../fixtures/publications";
import { publicationTones } from "../../../fixtures/publications";
import { Icon } from "../icons";
import { WaitingDot } from "../placeholder-rows";

import type { SlotBar } from "./published-bar";

/** The kind of reference a pill names, which its leading glyph shows. */
export type ReferenceKind = "branch" | "pullRequest";

/** The size of the pill's glyphs, in px: its leading glyph and chevron. */
const glyphSize = 14;

/** How a fixture's published line opens; the pill's state word replaces it. */
const publishedPrefix = "Published ";

/**
 * What the pill says of a ready publication: the state word, then the day
 * that the fixture's published line names, such as `Ready · 15 Sep`. The
 * pill names the day only, as the application does, so a line that also
 * names the time of day keeps its day.
 */
export function readyDetail(published: string): string {
  const when = published.startsWith(publishedPrefix)
    ? published.slice(publishedPrefix.length)
    : published;
  return "Ready · " + (when.split(",")[0] ?? when);
}

/**
 * The publication pill: one rounded control on the muted surface with a
 * hairline, which holds the reference trigger and what the stage shows of
 * it. The trigger keeps the reference as its own label, so the glyph, the
 * state and the chevron around it stay outside its element and are
 * decorative. While a read decides the reference, the pill holds the
 * trigger's placeholder, which takes the muted surface itself, so the pill
 * takes the bar's surface.
 */
export function Pill({
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
 * pill leaves out, or its placeholder while a read decides that state. A
 * desktop drawing draws both compositions, so there the dot carries the class
 * that shows it in the compact bar only.
 */
export function PillDot({
  state,
  part,
}: {
  /** The publication's state, once a read gives it. */
  state?: PublicationState;
  part?: SlotBar["part"];
}) {
  return (
    <span
      className={
        part === undefined ? "fo-canvas-pill-dot" : "fo-canvas-pill-dot " + part
      }
    >
      {state === undefined ? (
        <WaitingDot />
      ) : (
        <StatusDot
          moklyInstance={"viewer-state-" + state + "-compact"}
          tone={publicationTones[state]}
        />
      )}
    </span>
  );
}

/**
 * What the full pill says after its trigger: a hairline, the decorative
 * status dot, the state's phrase, the short SHA in mono and the chevron at
 * the pill's end. The compact pill leaves it out, so there the trigger
 * carries the chevron.
 */
export function PillState({
  state,
  detail,
  sha,
}: {
  state: PublicationState;
  detail: string;
  sha?: string;
}) {
  return (
    <span className="fo-top-state">
      <span className="fo-canvas-pill-rule" />
      <StatusDot
        moklyInstance={"viewer-state-" + state}
        tone={publicationTones[state]}
      />
      <span className="fo-top-state-detail">{detail}</span>
      {sha && <code className="mono-value">{sha}</code>}
      <PillChevron />
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
