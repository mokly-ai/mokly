// The metadata rows of the details inspector: the label/value pair itself,
// path and tag chips, the use cases a screen belongs to, and the links between
// a screen and the variants it declares.

import type { ReactNode } from "react";

import { catalogueViewHref } from "../navigation/delivery.js";
import type { ManifestEntry, ManifestUseCase } from "../registry/types.js";

import type { Catalogue } from "./catalogue.js";
import { FlowIcon, ScreenIcon, VariantIcon } from "./icons.js";
import { TagChip } from "./tags.js";
import type { RoutedEntry } from "./target.js";

/** One label/value pair in the inspector's metadata column. */
export function MetaRow(props: { children: ReactNode; label: string }) {
  return (
    <div className="mbk-meta-row">
      <span className="mbk-meta-k">{props.label}</span>
      <span className="mbk-meta-v">{props.children}</span>
    </div>
  );
}

/** Generated, source, or dependency paths rendered as monospace chips. */
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

/** The variants a screen declares, in manifest order. */
export function VariantChips(props: {
  catalogue: Catalogue;
  entry: RoutedEntry;
}) {
  if (props.entry.kind !== "screen") {
    return null;
  }
  const variants = (
    props.catalogue.hierarchy.variantsById.get(props.entry.id) ?? []
  ).filter(
    (variant): variant is Exclude<ManifestEntry, { kind: "collection" }> =>
      variant.kind !== "collection",
  );
  if (variants.length === 0) {
    return null;
  }
  return (
    <MetaRow label="Variants">
      <span className="mbk-chips">
        {variants.map((variant) => (
          <a
            className="mbk-chip screen"
            href={catalogueViewHref(variant.route)}
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

/** The screen a variant belongs to, resolved for current and removed entries. */
export function VariantOfChip(props: {
  catalogue: Catalogue;
  entry: RoutedEntry;
}) {
  if (props.entry.kind !== "screen" || props.entry.variantOf === undefined) {
    return null;
  }
  const parent =
    props.catalogue.hierarchy.variantParentById.get(props.entry.id) ??
    props.catalogue.byId.get(props.entry.variantOf);
  if (parent === undefined || parent.kind === "collection") {
    return null;
  }
  return (
    <MetaRow label="Variant of">
      <span className="mbk-chips">
        <a className="mbk-chip screen" href={catalogueViewHref(parent.route)}>
          <ScreenIcon size={11} />
          {parent.title}
        </a>
      </span>
    </MetaRow>
  );
}
