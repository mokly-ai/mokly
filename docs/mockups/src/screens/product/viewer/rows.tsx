import type { ReactNode } from "react";

import type { BuildName } from "../../../fixtures/builds";
import type { PublicationRef } from "../../../fixtures/publications";
import { publicationTones } from "../../../fixtures/publications";
import { TextBar } from "../placeholders";

import { PanelList } from "./panel-rows";
import type { PanelRow } from "./panel-rows";

/**
 * The drawing of each failed build a row opens through Details. That build's
 * own address shows it, while the reference's stage may show another card
 * instead: a closed or fork pull request's, or the Team card.
 */
const failedBuildDrawings: Partial<Record<BuildName, string>> = {
  lockfile: "product/viewer/standalone/build/lockfile",
};

/**
 * Where a row with nothing ready whose newest attempt failed opens through
 * Details: a failed publication's own details, or the failed build's.
 */
function failedDetails(ref: PublicationRef): string {
  if (ref.build === undefined) return "product/viewer/standalone/failed";
  const drawing = failedBuildDrawings[ref.build];
  if (drawing === undefined)
    throw new Error("The failed build " + ref.build + " has no drawing.");
  return drawing;
}

/** Where a group's rows lead, which only the loaded group knows. */
interface RefDestinations {
  refs: readonly PublicationRef[];
  destination: string;
  /** Where a reference with nothing ready opens while its first build runs. */
  building: string;
  /** Where a reference with nothing ready opens; its address resolves too. */
  unpublished: string;
  /** The reference the reader is on, whose row says Current. */
  current?: string;
}

/**
 * A group of publication rows under its label. A branch reads in mono, as a
 * reference does, and a pull request keeps its number and title in sans.
 *
 * Every reference is somewhere the reader can go, because the address of a
 * branch or pull request resolves whether or not it has a ready publication.
 * A reference with one opens it, even while a build publishes a newer push; a
 * reference with none opens the stage that shows its running build or offers
 * to publish it. Two lead somewhere else. The reference the reader is on is
 * where they already are, so its row says Current in place of a
 * destination. A reference with nothing ready whose newest attempt failed
 * offers that attempt's own details, because there is no catalogue behind it
 * to open instead: a failed publication opens its own details, and a failed
 * build opens that build.
 *
 * While the switcher's read runs, `waiting` is the label's width in its own
 * type, as a CSS length: only a group with references shows its label, so the
 * label is a bar, and one placeholder row stands for the references, its
 * destination's label as text with no link.
 */
export function RefGroup(
  props: {
    label: string;
    kind: "branch" | "pullRequest";
    children?: ReactNode;
  } & (RefDestinations | { waiting: string }),
) {
  const waits = "waiting" in props;
  return (
    <section className="fo-ref-group">
      {waits ? (
        <span className="fo-group-label" aria-hidden="true">
          <TextBar width={props.waiting} />
        </span>
      ) : (
        <span className="fo-group-label">{props.label}</span>
      )}
      <PanelList
        label={props.label}
        rows={
          waits
            ? [
                {
                  id: "waiting",
                  title: "",
                  detail: "",
                  status: "neutral",
                  sha: "",
                  to: "product/viewer/standalone",
                  action: "Open",
                  waiting: true,
                },
              ]
            : refRows(props)
        }
      />
      {props.children}
    </section>
  );
}

/** Each reference's row, with where it leads. */
function refRows({
  kind,
  refs,
  destination,
  building,
  unpublished,
  current,
}: RefDestinations & { kind: "branch" | "pullRequest" }): PanelRow[] {
  return refs.map((ref) => ({
    id: ref.id,
    title: ref.name,
    form: kind === "branch" ? "reference" : "pullRequest",
    detail: ref.detail,
    status: publicationTones[ref.state],
    // A reference with no commit yet has no SHA to show.
    ...(ref.sha === undefined ? {} : { sha: ref.sha }),
    ...(ref.name === current
      ? { current: true, mark: "Current" }
      : ref.ready
        ? { to: destination, action: "Open" }
        : ref.state === "failed"
          ? { to: failedDetails(ref), action: "Details" }
          : ref.state === "publishing"
            ? { to: building, action: "Open" }
            : { to: unpublished, action: "Open" }),
  }));
}
