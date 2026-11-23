import type { ReactNode } from "react";

import { Action } from "../components/action";
import { StateDot } from "../components/controls";
import { Icon } from "../components/icons";
import { WaitingDot } from "../components/placeholder-rows";

import { useCompactBar } from "./bar-width";
import type { PublicationState } from "./resolution";
import { publicationTones } from "./resolution";

/** The kind of reference a pill names, which its leading glyph shows. */
export type ReferenceKind = "branch" | "pullRequest";

/** The size of the pill's glyphs, in px: its leading glyph and its chevron. */
const glyphSize = 14;

/**
 * The pill's accessible name and tooltip: the whole reference, the state's
 * phrase and the short SHA, in the order the full pill shows them. The
 * compact pill and a narrower bar show fewer of them, so the name holds every
 * word that the pill can show.
 */
export function pillName(
  reference: string,
  state: { detail: string; sha?: string },
): string {
  return [reference, state.detail, state.sha]
    .filter((part) => part !== undefined && part !== "")
    .join(", ");
}

/**
 * The publication pill's frame, as the catalogue draws it: one rounded box
 * on the muted surface with a hairline. A ready pill holds the one quiet
 * Button that fills it, so the pill is the control the reader presses, and
 * the frame gives the Button's name as its tooltip. While nothing names the
 * reference, the pill holds no control: the reference's placeholder, which
 * takes the muted surface itself, so the pill takes the bar's surface.
 */
export function PublicationPill({
  waiting = false,
  title,
  children,
}: {
  waiting?: boolean;
  title?: string;
  children: ReactNode;
}) {
  return (
    <span
      className={
        waiting ? "fo-canvas-pill fo-canvas-pill-waiting" : "fo-canvas-pill"
      }
      title={title}
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
 * The reference as the pill draws it, on one line cut with an ellipsis: a
 * branch in regular mono, as a reference reads; a pull request's number in
 * semibold, then its title in sans; and a name that stands in for a
 * reference that no read has reached, such as This build, in sans.
 */
export function PillReference({
  reference,
  kind,
}: {
  reference: string;
  kind?: ReferenceKind;
}) {
  // A pull request's name starts with its number, which never holds a space.
  const space = reference.indexOf(" ");
  const number = space > 0 ? reference.slice(0, space) : reference;
  const branch = kind === "branch";
  return (
    <span className="fo-top-reference">
      {kind === "pullRequest" ? (
        <span className="fo-canvas-pill-name" dir="auto">
          <span className="fo-canvas-pill-number">{number}</span>
          {space > 0 && reference.slice(space)}
        </span>
      ) : (
        <span
          className={
            "fo-canvas-pill-name" + (branch ? " fo-canvas-pill-branch" : "")
          }
          dir="auto"
        >
          {reference}
        </span>
      )}
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

/** The chevron at the end of the pill, the switcher's glyph. */
export function PillChevron() {
  return (
    <span className="fo-canvas-pill-chevron">
      <Icon name="switcher" size={glyphSize} />
    </span>
  );
}

/**
 * The compact bar's name for a reference: a pull request's number, or the
 * last segment of a branch.
 */
function compactName(label: string): string {
  const slash = label.lastIndexOf("/");
  const space = label.indexOf(" ");
  if (label.startsWith("#") && space > 0) return label.slice(0, space);
  return slash >= 0 ? label.slice(slash + 1) : label;
}

/**
 * The publication pill: the branch or pull request the stage is showing, what
 * the stage shows of it, and the way to another, as one quiet Button that
 * fills the pill and draws its parts as its own content, so a press anywhere
 * on the pill opens the switcher. The full pill draws the reference's glyph,
 * the whole reference and the publication's state, which ends with the
 * chevron. The compact pill draws the status dot, the glyph, the reference's
 * compact name and the chevron, and the bar hides the state. In both, the
 * whole reference, the state's phrase and the short SHA are the Button's name
 * and the pill's tooltip, so a part that the bar drops stays in the name.
 */
export function PublicationTrigger({
  label,
  kind,
  state,
  detail,
  sha,
  open,
  onOpen,
}: {
  label: string;
  kind?: ReferenceKind;
  state: PublicationState;
  detail: string;
  sha?: string;
  open: boolean;
  onOpen: () => void;
}) {
  const compact = useCompactBar();
  const name = pillName(label, { detail, sha });
  return (
    <PublicationPill title={name}>
      <Action
        label={name}
        tone="quiet"
        size="sm"
        block
        expanded={open}
        hasPopup="dialog"
        onPress={onOpen}
        testID="viewer-publication"
        content={
          <span className="fo-canvas-pill-content">
            {compact && <PillDot state={state} />}
            {kind && <PillGlyph kind={kind} />}
            <PillReference
              reference={compact ? compactName(label) : label}
              kind={kind}
            />
            <PublicationMeta state={state} detail={detail} sha={sha} />
            {compact && <PillChevron />}
          </span>
        }
      />
    </PublicationPill>
  );
}

/**
 * What the full pill says about the publication the stage is showing, after
 * its reference: a hairline, the decorative status dot, the state's phrase,
 * the short SHA in mono and the chevron at the pill's end. The reference
 * leads, so the pill names what the reader recognizes and the publication's
 * own identity stays secondary. The compact bar hides it. While nothing names
 * the reference, it stands beside the reference's placeholder.
 */
export function PublicationMeta({
  state,
  detail,
  sha,
}: {
  state: PublicationState;
  detail: string;
  sha?: string;
}) {
  return (
    <span className="fo-top-state" data-mkc-publication-state={state}>
      <span className="fo-canvas-pill-rule" />
      <StateDot tone={publicationTones[state]} />
      <span className="fo-top-state-detail">{detail}</span>
      {sha && <code className="mono-value">{sha}</code>}
      <PillChevron />
    </span>
  );
}
