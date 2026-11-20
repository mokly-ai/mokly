import type { ReactNode } from "react";

import { ContentList } from "../../../entries/design/content-list.mockup";
import type { BuildName } from "../../../fixtures/builds";
import type { PublicationRef } from "../../../fixtures/publications";
import { publicationTones } from "../../../fixtures/publications";
import { TextBar } from "../placeholders";

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
}

/**
 * A group of publication rows under its label.
 *
 * Every reference is somewhere the reader can go, because the address of a
 * branch or pull request resolves whether or not it has a ready publication.
 * A reference with one opens it, even while a build publishes a newer push; a
 * reference with none opens the stage that shows its running build or offers
 * to publish it. One leads somewhere else: a reference with nothing ready
 * whose newest attempt failed offers that attempt's own details, because
 * there is no catalogue behind it to open instead. A failed publication opens
 * its own details, and a failed build opens that build.
 *
 * While the switcher's read runs, `waiting` is the label's width in its own
 * type, as a CSS length: only a group with references shows its label, so the
 * label is a bar, and one placeholder row stands for the references, its
 * destination's label as text with no link.
 */
export function RefGroup(
  props: {
    instance: string;
    label: string;
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
      <ContentList
        moklyInstance={props.instance}
        label={props.label}
        rows={
          waits
            ? [
                {
                  id: "waiting",
                  title: "",
                  detail: "",
                  status: "neutral",
                  meta: "",
                  mono: true,
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
  refs,
  destination,
  building,
  unpublished,
}: RefDestinations) {
  return refs.map((ref) => ({
    id: ref.id,
    title: ref.name,
    detail: ref.detail,
    status: publicationTones[ref.state],
    // The registered list refuses an `undefined` value, so a reference with
    // no commit yet passes no `meta` at all.
    ...(ref.sha === undefined ? {} : { meta: ref.sha }),
    mono: true,
    ...(ref.ready
      ? { to: destination, action: "Open" }
      : ref.state === "failed"
        ? { to: failedDetails(ref), action: "Details" }
        : ref.state === "publishing"
          ? { to: building, action: "Open" }
          : { to: unpublished, action: "Open" }),
  }));
}
