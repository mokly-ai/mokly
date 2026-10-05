// The served collapsible details inspector: a native <details> bar above a
// two-column body with prose on the left and metadata rows on the right —
// populated from the manifest entry for the selected route.

import type { ReactNode } from "react";

import type { ManifestScreen } from "../registry/types.js";

import type { Catalogue, CatalogueManifestEntry } from "./catalogue.js";
import { branchPoints } from "./catalogue_branch_point.js";
import {
  ChangedViewsRow,
  MetaRow,
  RelatedDocChips,
  TagChips,
  UsedByChips,
  VariantChips,
  VariantOfChip,
} from "./details_rows.js";
import { ChevronIcon } from "./icons.js";
import { useOptionalShellStore } from "./store_context.js";
import type { RouteTarget } from "./target.js";
import type { ChangedView } from "./view_marks.js";

/** The schemes a screen renders in, named for the reader. */
function schemeNames(screen: ManifestScreen): string {
  return screen.colorSchemes.join(", ");
}

export function EntryDetailsBody(props: {
  catalogue: Catalogue;
  changedViews?: readonly ChangedView[];
  entry: CatalogueManifestEntry;
}) {
  const entry = props.entry;
  const removed = props.catalogue.removedEntries.find(
    (record) => record.entry.path === entry.path,
  );
  const movedFrom = removed
    ? undefined
    : branchPoints(props.catalogue).previousPath(entry);
  return (
    <div className="mbk-details-body">
      <div>
        <p className="mbk-details-desc">{entry.description}</p>
        {entry.rationale ? (
          <p className="mbk-details-rationale">
            <span className="k">
              Why this {entry.kind === "use-case" ? "flow" : entry.kind} —{" "}
            </span>
            {entry.rationale}
          </p>
        ) : null}
      </div>
      <div className="mbk-meta">
        {entry.kind === "component" ? (
          <MetaRow label="Path">
            <code className="mbk-code">{entry.path}</code>
          </MetaRow>
        ) : null}
        <MetaRow label="Source">
          <code className="mbk-code">{entry.sourcePath}</code>
        </MetaRow>
        {movedFrom ? (
          <MetaRow label="Moved from">
            <code className="mbk-code">{movedFrom}</code>
          </MetaRow>
        ) : null}
        {entry.kind === "screen" && props.catalogue.hasDarkFragments ? (
          <MetaRow label="Schemes">{schemeNames(entry)}</MetaRow>
        ) : null}
        {entry.kind === "screen" || entry.kind === "component" ? (
          <ChangedViewsRow views={props.changedViews ?? []} />
        ) : null}
        {removed ? (
          <MetaRow label="Location">{removed.folderTitles.join(" › ")}</MetaRow>
        ) : null}
        <VariantOfChip catalogue={props.catalogue} entry={entry} />
        <VariantChips catalogue={props.catalogue} entry={entry} />
        <TagChips values={entry.tags ?? []} />
        {entry.relatedDocs.length > 0 ? (
          <MetaRow label="Related docs">
            <RelatedDocChips
              catalogue={props.catalogue}
              removed={removed !== undefined}
              values={entry.relatedDocs}
            />
          </MetaRow>
        ) : null}
        {entry.kind === "screen" ? (
          <UsedByChips
            catalogue={props.catalogue}
            useCasePaths={entry.useCasePaths}
          />
        ) : null}
      </div>
    </div>
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
  const open = store?.state.detailsOpen ?? false;
  return (
    <details
      className="mbk-details"
      data-mokly-details=""
      onToggle={(event) => {
        if (store?.interactive && event.currentTarget.open !== open)
          store.setDetails(event.currentTarget.open);
      }}
      open={open}
    >
      <summary className="mbk-details-bar">
        <span className="chev">
          <ChevronIcon size={12} />
        </span>
        Details
        <span className="mbk-details-hint">
          Description, rationale, source, related docs, and use cases
        </span>
      </summary>
      <EntryDetailsBody
        catalogue={props.catalogue}
        entry={props.target.entry}
      />
      {props.children}
    </details>
  );
}
