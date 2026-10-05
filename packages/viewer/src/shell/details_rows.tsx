// The metadata rows of the details inspector: the label/value pair itself,
// path and tag chips, the views a classification marked changed, the use cases
// a screen belongs to, and the links between a screen and the variants it
// declares.

import type { ReactNode } from "react";

import { branchPoints } from "../catalogue/branch_point.js";
import { parseLogicalTarget } from "../navigation/logical.js";
import { viewHref } from "../navigation/routes.js";
import type { ManifestUseCase } from "../registry/types.js";

import type { Catalogue, CatalogueManifestEntry } from "./catalogue.js";
import { FlowIcon, ScreenIcon, VariantIcon } from "./icons.js";
import { TagChip } from "./tags.js";
import { changedViewsLabel, type ChangedView } from "./view_marks.js";
import { WorkspaceIcon } from "./workspace_icons.js";

/** One label/value pair in the inspector's metadata column. */
export function MetaRow(props: { children: ReactNode; label: string }) {
  return (
    <div className="mbk-meta-row">
      <span className="mbk-meta-k">{props.label}</span>
      <span className="mbk-meta-v">{props.children}</span>
    </div>
  );
}

/**
 * The views a ready classification marked changed. The row is always present
 * so a background evidence refresh can name new views without rebuilding the
 * inspector, and stays hidden while there is nothing to name.
 */
export function ChangedViewsRow(props: { views: readonly ChangedView[] }) {
  const label = changedViewsLabel(props.views);
  return (
    <div
      className="mbk-meta-row"
      data-workspace-changed-views=""
      hidden={label === ""}
    >
      <span className="mbk-meta-k">Changed views</span>
      <span className="mbk-meta-v" data-workspace-changed-views-value="">
        {label}
      </span>
    </div>
  );
}

/**
 * The docs an entry names. A `mock:<path>` reference to a current document
 * links to that document, labelled with its title; any other value is the
 * repository label the catalogue published.
 */
export function RelatedDocChips(props: {
  catalogue: Catalogue;
  removed: boolean;
  values: readonly string[];
}) {
  return (
    <span className="mbk-chips">
      {props.values.map((value) => {
        const document = props.removed
          ? undefined
          : relatedDocument(props.catalogue, value);
        return document ? (
          <a
            className="mbk-meta-link"
            href={viewHref(document.path)}
            key={value}
          >
            {document.title}
          </a>
        ) : (
          <code className="mbk-code" key={value}>
            {value}
          </code>
        );
      })}
    </span>
  );
}

/**
 * The current document a related-doc value names, if it names one: a public
 * `mock:<path>` reference, or the repository source path the served manifest
 * keeps.
 */
function relatedDocument(
  catalogue: Catalogue,
  value: string,
): CatalogueManifestEntry | undefined {
  const target = parseLogicalTarget(value);
  const current = (entry: CatalogueManifestEntry | undefined) =>
    entry?.kind === "document" &&
    !catalogue.removedEntries.some(({ entry: removed }) => removed === entry)
      ? entry
      : undefined;
  if (target) return current(catalogue.byPath.get(target.path));
  for (const entry of catalogue.byPath.values())
    if (entry.sourcePath === value && current(entry)) return entry;
  return undefined;
}

/** Source or dependency paths rendered as monospace chips. */
export function PathChips(props: { values: readonly string[] }) {
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

/**
 * The tags an entry declares. Each chip is a control: the Browse client enters
 * `tag:<tag>` in the search field for it, so an unenhanced page still reads the
 * tags as text.
 */
export function TagChips(props: { values: readonly string[] }) {
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

/** The use cases whose ordered steps include this screen. */
export function UsedByChips(props: {
  catalogue: Catalogue;
  useCasePaths: readonly string[];
}) {
  const useCases = props.useCasePaths
    .map((id) => props.catalogue.byPath.get(id))
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
            href={viewHref(useCase.path)}
            key={useCase.path}
          >
            <FlowIcon size={11} />
            {useCase.title}
          </a>
        ))}
      </span>
    </MetaRow>
  );
}

/** The variants a screen or component declares, in manifest order. */
export function VariantChips(props: {
  catalogue: Catalogue;
  entry: CatalogueManifestEntry;
}) {
  if (props.entry.kind !== "screen" && props.entry.kind !== "component") {
    return null;
  }
  const historical = props.catalogue.removedEntries.some(
    ({ entry }) => entry.path === props.entry.path,
  );
  const variants = historical
    ? branchPoints(props.catalogue)
        .removedVariants(props.entry)
        .map(({ entry }) => entry)
    : (props.catalogue.hierarchy.variantsByPath.get(props.entry.path) ?? []);
  if (variants.length === 0) {
    return null;
  }
  return (
    <MetaRow label="Variants">
      <span className="mbk-chips">
        {variants.map((variant) => (
          <a
            className="mbk-chip screen"
            href={entryHref(props.catalogue, variant)}
            key={variant.path}
          >
            <VariantIcon size={11} />
            {variant.title}
          </a>
        ))}
      </span>
    </MetaRow>
  );
}

/** The parent a variant belongs to, resolved for current and removed entries. */
export function VariantOfChip(props: {
  catalogue: Catalogue;
  entry: CatalogueManifestEntry;
}) {
  const parent = branchPoints(props.catalogue).parentOf(props.entry);
  if (parent === undefined || parent.source === "title") {
    return null;
  }
  return (
    <MetaRow label="Variant of">
      <span className="mbk-chips">
        <a
          className="mbk-chip screen"
          href={entryHref(props.catalogue, parent.entry)}
        >
          {parent.entry.kind === "component" ? (
            <WorkspaceIcon name="components" size={11} />
          ) : (
            <ScreenIcon size={11} />
          )}
          {parent.entry.title}
        </a>
      </span>
    </MetaRow>
  );
}

function entryHref(
  catalogue: Catalogue,
  entry: CatalogueManifestEntry,
): string {
  const snapshotId = catalogue.removedEntries.find(
    ({ entry: candidate }) => candidate.path === entry.path,
  )?.snapshotId;
  return `${viewHref(entry.path)}${
    snapshotId ? `?snapshot=${snapshotId}` : ""
  }`;
}
