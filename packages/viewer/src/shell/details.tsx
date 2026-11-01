/**
 * The Details of the routed entry: its description, rationale, and metadata
 * rows, read from the catalogue record, and the collapsible panel that shows
 * them below a page's stage. These containers read the catalogue and the
 * store. `@mokly/ui/details-panel` renders the panel and the body, and
 * `@mokly/ui/metadata-row` the rows.
 */

import type { ReactNode } from "react";

import {
  DetailsBody,
  DetailsPanel as DetailsPanelView,
} from "@mokly/ui/details-panel";
import { MetadataCode, MetadataRow } from "@mokly/ui/metadata-row";

import type {
  ShellCatalogueScreen,
  ShellCatalogueRoutedEntry,
} from "../catalogue/scoped_types.js";

import type { Catalogue } from "./catalogue.js";
import { branchPoints } from "./catalogue_branch_point.js";
import {
  ChangedViewsRow,
  RelatedDocChips,
  TagChips,
  UsedByChips,
  VariantChips,
  VariantOfChip,
} from "./details_rows.js";
import { useOptionalShellStore } from "./store_context.js";
import type { RouteTarget } from "./target.js";
import { SCHEME_LABELS, type ChangedView } from "./view_marks.js";

/** The schemes a screen renders in, named for the reader. */
function schemeNames(screen: ShellCatalogueScreen): string {
  return screen.colorSchemes.map((scheme) => SCHEME_LABELS[scheme]).join(", ");
}

export function EntryDetailsBody(props: {
  catalogue: Catalogue;
  changedViews?: readonly ChangedView[];
  entry: ShellCatalogueRoutedEntry;
}) {
  const entry = props.entry;
  const removed = props.catalogue.removedEntries.find(
    (record) => record.entry.path === entry.path,
  );
  const movedFrom = removed
    ? undefined
    : branchPoints(props.catalogue).previousPath(entry);
  return (
    <DetailsBody
      description={entry.details.description}
      {...(entry.details.rationale
        ? {
            rationale: {
              noun: entry.kind === "use-case" ? "flow" : entry.kind,
              text: entry.details.rationale,
            },
          }
        : {})}
    >
      {entry.kind === "component" ? (
        <MetadataRow label="Path">
          <MetadataCode>{entry.path}</MetadataCode>
        </MetadataRow>
      ) : null}
      <MetadataRow label="Source">
        <MetadataCode>{entry.details.sourcePath}</MetadataCode>
      </MetadataRow>
      {movedFrom ? (
        <MetadataRow label="Moved from">
          <MetadataCode>{movedFrom}</MetadataCode>
        </MetadataRow>
      ) : null}
      {entry.kind === "screen" && props.catalogue.hasDarkFragments ? (
        <MetadataRow label="Schemes">{schemeNames(entry)}</MetadataRow>
      ) : null}
      {entry.kind === "screen" || entry.kind === "component" ? (
        <ChangedViewsRow views={props.changedViews ?? []} />
      ) : null}
      {removed?.folderTitles.length ? (
        <MetadataRow label="Location">
          {removed.folderTitles.join(" › ")}
        </MetadataRow>
      ) : null}
      <VariantOfChip catalogue={props.catalogue} entry={entry} />
      <VariantChips catalogue={props.catalogue} entry={entry} />
      <TagChips values={entry.tags ?? []} />
      {entry.details.relatedDocs.length > 0 ? (
        <MetadataRow label="Related docs">
          <RelatedDocChips
            catalogue={props.catalogue}
            removed={removed !== undefined}
            values={entry.details.relatedDocs}
          />
        </MetadataRow>
      ) : null}
      {entry.kind === "screen" ? (
        <UsedByChips
          catalogue={props.catalogue}
          useCasePaths={entry.useCasePaths}
        />
      ) : null}
    </DetailsBody>
  );
}

/**
 * The collapsed-by-default details panel for the selected route. Any
 * comparison details follow the authored metadata.
 */
export function DetailsPanel(props: {
  catalogue: Catalogue;
  children?: ReactNode;
  target: RouteTarget;
}) {
  const store = useOptionalShellStore();
  return (
    <DetailsPanelView
      onOpenChange={
        store?.interactive ? (open) => store.setDetails(open) : undefined
      }
      open={store?.state.detailsOpen ?? false}
    >
      <EntryDetailsBody
        catalogue={props.catalogue}
        entry={props.target.entry}
      />
      {props.children}
    </DetailsPanelView>
  );
}
