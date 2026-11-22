import type { ReactNode, RefObject } from "react";

import { Action } from "../components/action";
import type { ActionIcon } from "../components/action";
import { StateDot } from "../components/controls";
import { SiteLink } from "../components/page-parts";

import { useBarLabels, useCompactBar } from "./bar-width";
import type { ViewerSlotName } from "./host";
import { PillChevron } from "./pill";
import type { PublicationState } from "./resolution";
import { publicationTones } from "./resolution";
import { useViewerSlotSource } from "./slot-source";

/**
 * A control that carries a cloud action, or More for the actions it groups,
 * and that the reader's focus can come back to. A handoff, a route
 * reconstruction or a change of the bar's composition can replace the element
 * an overlay was opened from, so the way back is the slot that carries the
 * opening action now, as the bar's placement says, rather than that element.
 */
export function Slot({
  name,
  slotRef,
  title,
  className,
  children,
}: {
  name: ViewerSlotName;
  slotRef?: RefObject<HTMLSpanElement | null>;
  title?: string;
  className?: string;
  children: ReactNode;
}) {
  const source = useViewerSlotSource();
  return (
    <span
      className={"fo-top-slot" + (className ? " " + className : "")}
      data-mkc-viewer-slot={name}
      data-mkc-viewer-source={source}
      ref={slotRef}
      title={title}
    >
      {children}
    </span>
  );
}

/**
 * The workspace and project the reader is inside, and the way to another: one
 * quiet Button labelled with the project, with the workspace as its muted
 * lead, so a press anywhere on the two opens the projects. The whole
 * `workspace / project` is its accessible name and tooltip.
 */
export function ProjectTrigger({
  workspace,
  project,
  open,
  onOpen,
  slotRef,
}: {
  workspace?: string;
  project: string;
  open: boolean;
  onOpen: () => void;
  slotRef?: RefObject<HTMLSpanElement | null>;
}) {
  const compact = useCompactBar();
  const lead = compact || !workspace ? undefined : workspace;
  const whole = lead === undefined ? project : lead + " / " + project;
  return (
    <Slot
      name="projects"
      slotRef={slotRef}
      className="fo-top-project"
      title={whole}
    >
      <span className="fo-top-variable-control">
        <Action
          label={project}
          lead={lead}
          accessibilityLabel={whole}
          tone="quiet"
          size="sm"
          chevron
          block
          singleLine
          expanded={open}
          hasPopup="dialog"
          onPress={onOpen}
          testID="viewer-project"
        />
      </span>
    </Slot>
  );
}

/**
 * The branch or pull request the stage is showing, and the way to another:
 * the quiet Button inside the publication pill, which is the frame the reader
 * sees. The compact pill's trigger carries the chevron, and the full pill
 * draws its chevron after the state.
 */
export function PublicationTrigger({
  label,
  open,
  onOpen,
}: {
  label: string;
  open: boolean;
  onOpen: () => void;
}) {
  const compact = useCompactBar();
  const slash = label.lastIndexOf("/");
  const space = label.indexOf(" ");
  const shown =
    compact && label.startsWith("#") && space > 0
      ? label.slice(0, space)
      : compact && slash >= 0
        ? label.slice(slash + 1)
        : label;
  return (
    <span className="fo-top-reference" title={label}>
      <Action
        label={shown}
        accessibilityLabel={label}
        tone="quiet"
        size="sm"
        chevron={compact}
        block
        singleLine
        expanded={open}
        hasPopup="dialog"
        onPress={onOpen}
        testID="viewer-publication"
      />
    </span>
  );
}

/**
 * What the full pill says about the publication the stage is showing, after
 * its trigger: a hairline, the decorative status dot, the state's phrase, the
 * short SHA in mono and the chevron at the pill's end. The state sits outside
 * the trigger, so the trigger's label stays the reference the reader
 * recognizes and the publication's own identity stays secondary. The compact
 * bar hides it.
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

/** The pull request this publication came from, on GitHub. */
export function PullRequestLink({ url }: { url: string }) {
  return <SiteLink href={url} label="GitHub" />;
}

/**
 * What a bar control does when pressed: open its overlay. While the route
 * reads the project, it opens nothing yet, so it is `waiting`: it keeps its
 * label and draws itself disabled, with no test handle, because the control
 * a test means is the one that opens something.
 */
export type BarPress =
  | {
      testID: string;
      onPress: () => void;
      open?: boolean;
      disabled?: boolean;
      slotRef?: RefObject<HTMLSpanElement | null>;
      waiting?: undefined;
    }
  | {
      waiting: true;
      testID?: undefined;
      onPress?: undefined;
      open?: undefined;
      disabled?: undefined;
      slotRef?: undefined;
    };

/**
 * A repeat action in the bar's trail, compact and on one line. Only Share can
 * spend the accent: while no overlay is open, its caller marks it `filled`,
 * and it is the screen's one filled action where the package's slots hold it,
 * because the package draws only a ready publication. The cloud's own bar
 * stands over a stage card, which owns that action, so there it keeps `tone`.
 * An action with a glyph draws its glyph alone where the bar has no room for
 * its label, and keeps its name and tooltip; it stays one control, so it
 * keeps its focus when the drawing changes.
 */
export function BarAction({
  label,
  testID,
  onPress,
  open,
  chevron,
  icon,
  disabled,
  slotRef,
  tone = "quiet",
  filled = false,
  popup = "dialog",
  slot,
  waiting,
}: BarPress & {
  label: string;
  chevron?: boolean;
  /** The glyph before the label, or instead of it, such as History's clock. */
  icon?: ActionIcon;
  tone?: "secondary" | "quiet";
  filled?: boolean;
  popup?: "dialog" | "menu";
  slot: ViewerSlotName;
}) {
  const ready = useViewerSlotSource() === "package";
  const labels = useBarLabels();
  return (
    <Slot name={slot} slotRef={slotRef} title={label} className="fo-top-fixed">
      <span>
        <Action
          label={label}
          accessibilityLabel={label}
          tone={filled && ready ? "primary" : tone}
          size="sm"
          chevron={chevron}
          icon={icon}
          iconOnly={icon === undefined ? undefined : !labels}
          singleLine
          expanded={open}
          hasPopup={popup}
          disabled={waiting === true || disabled}
          onPress={onPress}
          testID={testID}
        />
      </span>
    </Slot>
  );
}

/**
 * The newest publication on this reference has arrived. The reader stays where
 * they are until they say otherwise, because moving a reader mid-read loses
 * their place.
 */
export function ViewLatest({ onOpen }: { onOpen: () => void }) {
  return (
    <Action
      label="View latest"
      tone="secondary"
      size="sm"
      onPress={onOpen}
      testID="view-latest"
    />
  );
}
