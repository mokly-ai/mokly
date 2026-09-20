// The served collapsible details inspector: a native <details> bar above a
// two-column body with prose on the left and metadata rows on the right —
// populated from the manifest entry for the selected route: description,
// rationale, source and generated paths, declared tags, related docs,
// dependencies, the variants a screen declares or belongs to, and the use
// cases a screen belongs to. The rows themselves live in `details_rows.tsx`.

import type { ColorScheme } from "../data/axes.js";
import type { ManifestScreen } from "../registry/types.js";

import type { Catalogue } from "./catalogue.js";
import {
  MetaRow,
  PathChips,
  TagChips,
  UsedByChips,
  VariantChips,
  VariantOfChip,
} from "./details_rows.js";
import { ChevronIcon } from "./icons.js";
import type { RoutedEntry, RouteTarget } from "./target.js";

/** Generated fragment routes for a screen, dark renders after the light ones. */
function generatedPaths(screen: ManifestScreen): string[] {
  const paths = [screen.fragments.mobile, screen.fragments.desktop];
  if (screen.darkFragments) {
    paths.push(screen.darkFragments.mobile, screen.darkFragments.desktop);
  }
  return paths;
}

/** The schemes a screen renders in, named for the reader. */
function schemeNames(screen: ManifestScreen): string {
  const schemes: readonly ColorScheme[] = screen.darkFragments
    ? ["light", "dark"]
    : ["light"];
  return schemes.join(", ");
}

export function EntryDetailsBody(props: {
  catalogue: Catalogue;
  entry: RoutedEntry;
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
        {entry.kind === "screen" ? (
          <MetaRow label="Generated">
            <PathChips values={generatedPaths(entry)} />
          </MetaRow>
        ) : null}
        {entry.kind === "page" ? (
          <MetaRow label="Generated">
            <PathChips values={[entry.route]} />
          </MetaRow>
        ) : null}
        {entry.kind === "screen" && props.catalogue.hasDarkFragments ? (
          <MetaRow label="Schemes">{schemeNames(entry)}</MetaRow>
        ) : null}
        {props.catalogue.removedEntries.find(
          (removed) => removed.entry.route === entry.route,
        ) ? (
          <MetaRow label="Location">
            {props.catalogue.removedEntries
              .find((removed) => removed.entry.route === entry.route)
              ?.ancestors.map(({ title }) => title)
              .join(" › ")}
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
        {entry.dependencies.length > 0 ? (
          <MetaRow label="Dependencies">
            <PathChips values={entry.dependencies} />
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

/** The collapsed-by-default details panel for the selected route. */
export function DetailsPanel(props: {
  catalogue: Catalogue;
  target: RouteTarget;
}) {
  return (
    <details className="mbk-details" data-mokly-details="">
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
