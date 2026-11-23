import { SharedUiThemeProvider, useSharedUiTheme } from "@firna/ui/theme";
import { quietOnMutedUiTheme } from "@mokly-cloud/tokens/shared-ui-theme";
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
 * The publication pill's frame: one rounded box on the muted surface with a
 * hairline. A ready pill holds one quiet registered Button that fills it, so
 * the pill is the control the reader presses, and the frame gives the
 * Button's name as its tooltip. The Button stands on the muted surface, so
 * the frame scopes the theme whose hover and press washes darken that
 * surface, as the application's does; a static drawing draws no hover, so
 * its pill keeps its look at rest. While a read decides the reference, the
 * pill holds no control: the reference's placeholder, which takes the muted
 * surface itself, so the pill takes the bar's surface. A desktop drawing
 * draws one pill for each composition, which carries the composition's class.
 */
export function Pill({
  waiting = false,
  part,
  title,
  children,
}: {
  waiting?: boolean;
  part?: SlotBar["part"];
  title?: string;
  children: ReactNode;
}) {
  const quiet = quietOnMutedUiTheme(useSharedUiTheme());
  return (
    <span
      className={["fo-canvas-pill", waiting && "fo-canvas-pill-waiting", part]
        .filter(Boolean)
        .join(" ")}
      title={title}
    >
      {waiting ? (
        children
      ) : (
        <SharedUiThemeProvider theme={quiet}>{children}</SharedUiThemeProvider>
      )}
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
 * reference, such as This build, in sans.
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
 * pill leaves out, or its placeholder while a read decides that state. A
 * waiting pill in a desktop drawing serves both compositions, so there the
 * dot carries the class that shows it in the compact bar only.
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
 * What the full pill says after its reference: a hairline, the decorative
 * status dot, the state's phrase, the short SHA in mono and the chevron at
 * the pill's end. The compact pill leaves it out and draws its chevron after
 * the reference.
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

/** The chevron at the end of the pill, the switcher's glyph. */
export function PillChevron() {
  return (
    <span className="fo-canvas-pill-chevron">
      <Icon name="switcher" size={glyphSize} />
    </span>
  );
}
