/**
 * The metadata rows of the details inspector that read the catalogue: the
 * views a classification marked changed, the related docs, the tags, the use
 * cases a screen belongs to, and the links between a screen and the variants
 * it declares. These containers resolve the entries and their addresses, and
 * `@mokly/ui/metadata-row` renders the rows and their chips.
 */

import {
  EntryChip,
  MetadataChips,
  MetadataCode,
  MetadataLink,
  MetadataRow,
} from "@mokly/ui/metadata-row";

import { parseLogicalTarget } from "../navigation/logical.js";
import { viewHref } from "../navigation/routes.js";
import type { ManifestUseCase } from "../registry/types.js";

import type { Catalogue, CatalogueManifestEntry } from "./catalogue.js";
import { branchPoints } from "./catalogue_branch_point.js";
import { TagChip } from "./tags.js";
import { changedViewsLabel, type ChangedView } from "./view_marks.js";

/**
 * The views a ready classification marked changed. The row is always present
 * so a background evidence refresh can name new views without rebuilding the
 * inspector, and stays hidden while there is nothing to name.
 */
export function ChangedViewsRow(props: { views: readonly ChangedView[] }) {
  const label = changedViewsLabel(props.views);
  return (
    <MetadataRow
      hidden={label === ""}
      label="Changed views"
      mark="data-workspace-changed-views"
      valueMark="data-workspace-changed-views-value"
    >
      {label}
    </MetadataRow>
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
    <MetadataChips>
      {props.values.map((value) => {
        const document = props.removed
          ? undefined
          : relatedDocument(props.catalogue, value);
        return document ? (
          <MetadataLink href={viewHref(document.path)} key={value}>
            {document.title}
          </MetadataLink>
        ) : (
          <MetadataCode key={value}>{value}</MetadataCode>
        );
      })}
    </MetadataChips>
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
    <MetadataRow label="Tags">
      <MetadataChips>
        {props.values.map((tag) => (
          <TagChip key={tag} tag={tag} />
        ))}
      </MetadataChips>
    </MetadataRow>
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
    <MetadataRow label="Used by">
      <MetadataChips>
        {useCases.map((useCase) => (
          <EntryChip
            href={viewHref(useCase.path)}
            key={useCase.path}
            kind="use-case"
            title={useCase.title}
          />
        ))}
      </MetadataChips>
    </MetadataRow>
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
    <MetadataRow label="Variants">
      <MetadataChips>
        {variants.map((variant) => (
          <EntryChip
            href={entryHref(props.catalogue, variant)}
            key={variant.path}
            kind="variant"
            title={variant.title}
          />
        ))}
      </MetadataChips>
    </MetadataRow>
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
    <MetadataRow label="Variant of">
      <MetadataChips>
        <EntryChip
          href={entryHref(props.catalogue, parent.entry)}
          kind={parent.entry.kind === "component" ? "component" : "screen"}
          title={parent.entry.title}
        />
      </MetadataChips>
    </MetadataRow>
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
