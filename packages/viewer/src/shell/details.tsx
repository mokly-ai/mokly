// The served collapsible details inspector: a native <details> bar above a
// two-column body with prose on the left and metadata rows on the right —
// populated from the manifest entry for the selected route.

import type { ManifestScreen } from "../registry/types.js";

import type { Catalogue, CatalogueManifestEntry } from "./catalogue.js";
import {
  ChangedViewsRow,
  MetaRow,
  PathChips,
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
        <MetaRow label="Source">
          <code className="mbk-code">{entry.sourcePath}</code>
        </MetaRow>
        {entry.kind === "screen" && props.catalogue.hasDarkFragments ? (
          <MetaRow label="Schemes">{schemeNames(entry)}</MetaRow>
        ) : null}
        {entry.kind === "screen" || entry.kind === "component" ? (
          <ChangedViewsRow views={props.changedViews ?? []} />
        ) : null}
        {props.catalogue.removedEntries.find(
          (removed) => removed.entry.id === entry.id,
        ) ? (
          <MetaRow label="Location">
            {props.catalogue.removedEntries
              .find((removed) => removed.entry.id === entry.id)
              ?.entry.navPath.join(" › ")}
          </MetaRow>
        ) : null}
        <VariantOfChip catalogue={props.catalogue} entry={entry} />
        <VariantChips catalogue={props.catalogue} entry={entry} />
        <TagChips values={entry.tags ?? []} />
        {entry.relatedDocs.length > 0 ? (
          <MetaRow label="Related docs">
            <PathChips values={entry.relatedDocs} />
          </MetaRow>
        ) : null}
        {entryDependencies(entry).length > 0 ? (
          <MetaRow label="Dependencies">
            <PathChips values={entryDependencies(entry)} />
          </MetaRow>
        ) : null}
        {entry.kind === "screen" ? (
          <UsedByChips
            catalogue={props.catalogue}
            useCaseIds={entry.useCaseIds}
          />
        ) : null}
      </div>
    </div>
  );
}

function entryDependencies(entry: CatalogueManifestEntry): readonly string[] {
  return "dependencies" in entry
    ? entry.dependencies
    : [...new Set([entry.sourcePath, ...entry.declaredDependencies])].sort();
}

/** The collapsed-by-default details panel for the selected route. */
export function DetailsPanel(props: {
  catalogue: Catalogue;
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
      {
        <EntryDetailsBody
          catalogue={props.catalogue}
          entry={props.target.entry}
        />
      }
    </details>
  );
}
