// The served collapsible details inspector: a native <details> bar above a
// two-column body with prose on the left and metadata rows on the right —
// populated from the manifest entry for the selected route: description,
// rationale, source and generated paths, declared tags, related docs,
// dependencies, and the use cases a screen belongs to. The tag chips are the
// one interactive metadata row: the Browse client turns a chip into the
// matching `tag:` search term.

import type { ReactNode } from "react";

import type { ColorScheme } from "../data/axes.js";
import { catalogueViewHref } from "../navigation/delivery.js";
import type { ManifestScreen, ManifestUseCase } from "../registry/types.js";

import type { Catalogue } from "./catalogue.js";
import { ChevronIcon, FlowIcon } from "./icons.js";
import { TagChip } from "./tags.js";
import type { RoutedEntry, RouteTarget } from "./target.js";

function MetaRow(props: { children: ReactNode; label: string }) {
  return (
    <div className="mbk-meta-row">
      <span className="mbk-meta-k">{props.label}</span>
      <span className="mbk-meta-v">{props.children}</span>
    </div>
  );
}

function PathChips(props: { values: readonly string[] }) {
  return (
    <span className="mbk-chips">
      {props.values.map((value) => (
        <code className="mbk-code" key={value}>
          {value}
        </code>
      ))}
    </span>
  );
}

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

/**
 * The tags an entry declares. Each chip is a control: the Browse client enters
 * `tag:<tag>` in the search field for it, so an unenhanced page still reads the
 * tags as text.
 */
function TagChips(props: { values: readonly string[] }) {
  if (props.values.length === 0) {
    return null;
  }
  return (
    <MetaRow label="Tags">
      <span className="mbk-chips">
        {props.values.map((tag) => (
          <TagChip key={tag} tag={tag} />
        ))}
      </span>
    </MetaRow>
  );
}

function UsedByChips(props: {
  catalogue: Catalogue;
  useCaseIds: readonly string[];
}) {
  const useCases = props.useCaseIds
    .map((id) => props.catalogue.byId.get(id))
    .filter(
      (entry): entry is ManifestUseCase =>
        entry !== undefined && entry.kind === "use-case",
    );
  if (useCases.length === 0) {
    return null;
  }
  return (
    <MetaRow label="Used by">
      <span className="mbk-chips">
        {useCases.map((useCase) => (
          <a
            className="mbk-chip flow"
            href={catalogueViewHref(useCase.route)}
            key={useCase.id}
          >
            <FlowIcon size={11} />
            {useCase.title}
          </a>
        ))}
      </span>
    </MetaRow>
  );
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
