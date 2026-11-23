/**
 * The head of Inspect: the routed entry's title, its `Component` tag, its
 * change status and its description, then its Details rows in the order of
 * the shell design: Path, whose folder segments are breadcrumbs, Source,
 * the address that a screen declares, Moved from, Schemes, Changed views,
 * Location, Variant of, Tags, Related docs and Used by. The rationale
 * follows in its own section. This container reads the catalogue, and
 * `@mokly/ui/inspect-panel` and `@mokly/ui/metadata-row` draw the parts.
 */

import type { ReactNode } from "react";

import { InspectHead, InspectRationale } from "@mokly/ui/inspect-panel";
import {
  MetadataCode,
  MetadataPath,
  MetadataRow,
  type MetadataPathSegment,
} from "@mokly/ui/metadata-row";

import type {
  ShellCatalogueRoutedEntry,
  ShellCatalogueScreen,
} from "../catalogue/scoped_types.js";

import type { Catalogue } from "./catalogue.js";
import { branchPoints } from "./catalogue_branch_point.js";
import type { CatalogueCrumb } from "./crumbs.js";
import {
  ChangedViewsRow,
  RelatedDocChips,
  TagChips,
  UsedByChips,
  VariantOfChip,
} from "./details_rows.js";
import { targetHead } from "./head.js";
import { useShellStore, type ShellStore } from "./store_context.js";
import { SCHEME_LABELS, type ChangedView } from "./view_marks.js";

/** The schemes a screen renders in, named for the reader. */
function schemeNames(screen: ShellCatalogueScreen): string {
  return screen.colorSchemes.map((scheme) => SCHEME_LABELS[scheme]).join(", ");
}

/**
 * The segments of an entry's path, each folder segment with the crumb of its
 * folder, which the crumb trail holds in the same order: a link to the
 * folder's own page, or a reveal of its row. A screen variant's last crumb
 * links its parent's segment to the parent's page.
 */
function pathSegments(
  path: string,
  crumbs: readonly CatalogueCrumb[],
  store: ShellStore,
): MetadataPathSegment[] {
  return path.split("/").map((text, index, segments) => {
    const crumb = index < segments.length - 1 ? crumbs[index] : undefined;
    if (crumb?.href) return { href: crumb.href, text };
    const revealed = crumb?.folder;
    return revealed
      ? {
          folder: revealed.path,
          onReveal: () => store.revealFolder(revealed.section, revealed.path),
          text,
        }
      : { text };
  });
}

/** The Details rows of an entry, after its path. */
function DetailRows({
  catalogue,
  changedViews,
  entry,
}: {
  catalogue: Catalogue;
  changedViews: readonly ChangedView[] | undefined;
  entry: ShellCatalogueRoutedEntry;
}) {
  const removed = catalogue.removedEntries.find(
    (record) => record.entry.path === entry.path,
  );
  const movedFrom = removed
    ? undefined
    : branchPoints(catalogue).previousPath(entry);
  return (
    <>
      <MetadataRow label="Source">
        <MetadataCode>{entry.details.sourcePath}</MetadataCode>
      </MetadataRow>
      {entry.kind === "screen" && entry.address ? (
        <MetadataRow label="Address" mark="data-inspect-address">
          <MetadataCode>{entry.address}</MetadataCode>
        </MetadataRow>
      ) : null}
      {movedFrom ? (
        <MetadataRow label="Moved from">
          <MetadataCode>{movedFrom}</MetadataCode>
        </MetadataRow>
      ) : null}
      {entry.kind === "screen" && catalogue.hasDarkFragments ? (
        <MetadataRow label="Schemes">{schemeNames(entry)}</MetadataRow>
      ) : null}
      {entry.kind === "screen" || entry.kind === "component" ? (
        <ChangedViewsRow views={changedViews ?? []} />
      ) : null}
      {removed?.folderTitles.length ? (
        <MetadataRow label="Location">
          {removed.folderTitles.join(" › ")}
        </MetadataRow>
      ) : null}
      <VariantOfChip catalogue={catalogue} entry={entry} />
      <TagChips values={entry.tags} />
      {entry.details.relatedDocs.length > 0 ? (
        <MetadataRow label="Related docs">
          <RelatedDocChips
            catalogue={catalogue}
            removed={removed !== undefined}
            values={entry.details.relatedDocs}
          />
        </MetadataRow>
      ) : null}
      {entry.kind === "screen" ? (
        <UsedByChips catalogue={catalogue} useCasePaths={entry.useCasePaths} />
      ) : null}
    </>
  );
}

/**
 * Inspect's head of the routed entry, with its rationale after it. `aside`
 * holds what the head adds at its end, such as an embedded root's Dark
 * preview control of a document.
 */
export function EntryInspectHead({
  aside,
  catalogue,
  changedViews,
  entry,
  status,
}: {
  aside?: ReactNode;
  catalogue: Catalogue;
  changedViews?: readonly ChangedView[] | undefined;
  entry: ShellCatalogueRoutedEntry;
  /** The change status beside the title, such as a `ChangeStatus`. */
  status?: ReactNode;
}) {
  const store = useShellStore();
  const head = targetHead(catalogue, { kind: "entry", entry });
  const rationale = entry.details.rationale;
  return (
    <>
      <InspectHead
        component={entry.kind === "component"}
        description={entry.details.description}
        status={status}
        title={head.title}
      >
        <MetadataRow label="Path" mark="data-inspect-path">
          <MetadataPath
            segments={pathSegments(entry.path, head.crumbs, store)}
          />
        </MetadataRow>
        <DetailRows
          catalogue={catalogue}
          changedViews={changedViews}
          entry={entry}
        />
        {aside}
      </InspectHead>
      {rationale ? (
        <InspectRationale
          noun={entry.kind === "use-case" ? "flow" : entry.kind}
          text={rationale}
        />
      ) : null}
    </>
  );
}
