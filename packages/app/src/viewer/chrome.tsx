import type { ReactNode, RefObject } from "react";

import { Action } from "../components/action";
import { StateDot } from "../components/controls";
import { SiteLink } from "../components/page-parts";

import { useCompactBar } from "./bar-width";
import type { ViewerSlotName } from "./host";
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

/** The workspace and project the reader is inside, and the way to another. */
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
  const label = compact || !workspace ? project : workspace + " / " + project;
  return (
    <Slot
      name="projects"
      slotRef={slotRef}
      className="fo-top-project"
      title={label}
    >
      <span className="fo-top-variable-control">
        <Action
          label={label}
          accessibilityLabel={label}
          tone="secondary"
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

/** The branch or pull request the stage is showing, and the way to another. */
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
        tone="secondary"
        size="sm"
        chevron
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
 * What the chrome says about the publication the stage is showing. The state
 * sits outside the trigger, so the trigger's label stays the reference the
 * reader recognizes and the publication's own identity stays secondary.
 */
export function PublicationMeta({
  state,
  detail,
  sha,
  children,
}: {
  state: PublicationState;
  detail: string;
  sha?: string;
  children?: ReactNode;
}) {
  return (
    <span className="fo-top-state" data-mkc-publication-state={state}>
      <StateDot tone={publicationTones[state]} />
      <span className="fo-top-state-detail">{detail}</span>
      {sha && <code className="mono-value">{sha}</code>}
      {children}
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
type BarPress =
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

/** A repeat action in the bar's trail; none of them spends the accent. */
export function BarAction({
  label,
  whole,
  testID,
  onPress,
  open,
  chevron,
  disabled,
  slotRef,
  tone = "quiet",
  popup = "dialog",
  slot,
  waiting,
}: BarPress & {
  label: string;
  /**
   * The whole value, when the label is a shortened form of it. It becomes the
   * control's accessible name and its tooltip, so a reader who cannot hover —
   * which is every reader on the surface where the label is shortened — can
   * still reach it.
   */
  whole?: string;
  chevron?: boolean;
  tone?: "secondary" | "quiet";
  popup?: "dialog" | "menu";
  slot: ViewerSlotName;
}) {
  const variable = slot === "account";
  return (
    <Slot
      name={slot}
      slotRef={slotRef}
      title={whole ?? label}
      className={variable ? "fo-top-account" : "fo-top-fixed"}
    >
      <span className={variable ? "fo-top-variable-control" : undefined}>
        <Action
          label={label}
          accessibilityLabel={whole ?? label}
          tone={tone}
          size="sm"
          chevron={chevron}
          block={variable}
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
