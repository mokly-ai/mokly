// The metadata rows of the details inspector: the label/value pair itself,
// path and tag chips, the views a classification marked changed, the use cases
// a screen belongs to, and the links between a screen and the variants it
// declares.

import type { ReactNode } from "react";

import { viewHref } from "../navigation/routes.js";
import type { ManifestUseCase } from "../registry/types.js";

import {
  catalogueVariantParent,
  type Catalogue,
  type CatalogueManifestEntry,
} from "./catalogue.js";
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
            href={viewHref(useCase.kind, useCase.id)}
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

/** The variants a screen or component declares, in manifest order. */
export function VariantChips(props: {
  catalogue: Catalogue;
  entry: CatalogueManifestEntry;
}) {
  if (props.entry.kind !== "screen" && props.entry.kind !== "component") {
    return null;
  }
  const historical = props.catalogue.removedEntries.some(
    ({ entry }) => entry.id === props.entry.id,
  );
  const variants = historical
    ? props.catalogue.removedEntries.flatMap(({ entry }) =>
        (entry.kind === "screen" || entry.kind === "component") &&
        "variantOf" in entry &&
        entry.variantOf === props.entry.id
          ? [entry]
          : [],
      )
    : (props.catalogue.hierarchy.variantsById.get(props.entry.id) ?? []);
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
            key={variant.id}
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
  if (
    (props.entry.kind !== "screen" && props.entry.kind !== "component") ||
    !("variantOf" in props.entry) ||
    props.entry.variantOf === undefined
  ) {
    return null;
  }
  const parent = catalogueVariantParent(props.catalogue, props.entry);
  if (parent === undefined) {
    return null;
  }
  return (
    <MetaRow label="Variant of">
      <span className="mbk-chips">
        <a
          className="mbk-chip screen"
          href={entryHref(props.catalogue, parent)}
        >
          {parent.kind === "component" ? (
            <WorkspaceIcon name="components" size={11} />
          ) : (
            <ScreenIcon size={11} />
          )}
          {parent.title}
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
    ({ entry: candidate }) => candidate.id === entry.id,
  )?.snapshotId;
  return `${viewHref(entry.kind, entry.id)}${
    snapshotId ? `?snapshot=${snapshotId}` : ""
  }`;
}
