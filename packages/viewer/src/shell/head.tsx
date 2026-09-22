// The heading for a catalogue view uses the title, stable ID, and text-only
// collection ancestors from the shared hierarchy or removed entry baseline.

import type { ReactNode } from "react";

import { catalogueViewHref } from "../navigation/delivery.js";
import type { ManifestEntry } from "../registry/types.js";

import type { Catalogue } from "./catalogue.js";
import { structuredCrumbTrail } from "./nav_tree.js";
import type { CatalogueCrumb } from "./nav_tree.js";
import { useOptionalShellStore } from "./store_context.js";
import type { RouteTarget } from "./target.js";

function Crumbs(props: { items: readonly CatalogueCrumb[] }) {
  return (
    <p aria-label="Catalogue location" className="mbk-crumbs">
      {props.items.map((item, index) => (
        <span key={`${item.label}-${index}`}>
          {index > 0 ? <span className="sep">›</span> : null}
          {item.href === undefined ? (
            item.label
          ) : (
            <a className="mbk-crumb-link" href={item.href}>
              {item.label}
            </a>
          )}
        </span>
      ))}
    </p>
  );
}

/** Viewport selection shown in the header of a screen route. */
export function ViewportSwitch() {
  const store = useOptionalShellStore();
  const options = [
    ["mobile", "Mobile"],
    ["desktop", "Desktop"],
    ["both", "Both"],
  ] as const;
  return (
    <span
      aria-label="Viewport"
      className="mbk-seg"
      data-mokly-viewswitch=""
      role="group"
    >
      {options.map(([value, label]) => (
        <button
          aria-pressed={(store?.state.selection.viewport ?? "both") === value}
          data-viewport-option={value}
          key={value}
          onClick={() => store?.selectViewport(value)}
          type="button"
        >
          {label}
        </button>
      ))}
    </span>
  );
}

/**
 * Color scheme selection for catalogues that render dark fragments. The shell
 * renders one instance in the top bar and one in the screen head band; the
 * stylesheet reveals whichever fits the current width.
 */
export function SchemeSwitch() {
  const store = useOptionalShellStore();
  const options = [
    ["light", "Light"],
    ["dark", "Dark"],
  ] as const;
  return (
    <span
      aria-label="Color scheme"
      className="mbk-seg"
      data-mokly-schemeswitch=""
      role="group"
    >
      {options.map(([value, label]) => (
        <button
          aria-pressed={
            (store?.state.selection.colorScheme ?? "light") === value
          }
          data-color-scheme-option={value}
          key={value}
          onClick={() => store?.selectColorScheme(value)}
          type="button"
        >
          {label}
        </button>
      ))}
    </span>
  );
}

/** The breadcrumb, title, and optional action rendered above a target view. */
export function ScreenHead(props: {
  action?: ReactNode;
  status?: ReactNode;
  crumbs: readonly CatalogueCrumb[];
  heading: string;
  id?: string | undefined;
}) {
  const store = useOptionalShellStore();
  return (
    <div className="mbk-screen-head">
      <div className="mbk-screen-head-copy">
        <Crumbs items={props.crumbs} />
        <div className="mbk-title-row">
          <h2>{props.heading}</h2>
          {props.status}
          {props.id ? (
            <button
              aria-label={`Copy ID ${props.id}`}
              className="mbk-idchip"
              data-copy-id={props.id}
              onClick={() =>
                store?.copy(props.id ?? "", `Copied ID ${props.id}`)
              }
              type="button"
            >
              #{props.id}
            </button>
          ) : null}
        </div>
      </div>
      {props.action}
    </div>
  );
}

/**
 * The parent screen a variant belongs to. A variant's own ancestors are the
 * parent's collection ancestors, so the parent itself closes the trail; a
 * removed variant resolves through its retained `variantOf` instead of the
 * hierarchy, which holds current entries only.
 */
function variantParent(
  catalogue: Catalogue,
  target: RouteTarget,
): ManifestEntry | undefined {
  const entry = target.entry;
  if (entry.kind !== "screen") {
    return undefined;
  }
  const historical = catalogue.removedEntries.some(
    ({ entry: candidate }) => candidate.route === entry.route,
  );
  if (historical)
    return entry.variantOf === undefined
      ? undefined
      : (catalogue.removedEntries.find(
          ({ entry: candidate }) => candidate.id === entry.variantOf,
        )?.entry ?? catalogue.byId.get(entry.variantOf));
  return (
    catalogue.hierarchy.variantParentById.get(entry.id) ??
    (entry.variantOf === undefined
      ? undefined
      : catalogue.byId.get(entry.variantOf))
  );
}

/** The breadcrumb trail, id, and title for one resolved route target. */
export function targetHead(
  catalogue: Catalogue,
  target: RouteTarget,
): { crumbs: CatalogueCrumb[]; id?: string; title: string } {
  const ancestors =
    catalogue.removedEntries
      .find(({ entry }) => entry.route === target.entry.route)
      ?.ancestors.map(({ title }) => ({ label: title })) ??
    structuredCrumbTrail(catalogue.hierarchy, target.entry.id);
  const parent = variantParent(catalogue, target);
  const parentSnapshot =
    parent && parent.kind !== "collection"
      ? catalogue.removedEntries.find(
          ({ entry }) => entry.route === parent.route,
        )?.snapshotId
      : undefined;
  return {
    crumbs:
      parent === undefined || parent.kind === "collection"
        ? ancestors
        : [
            ...ancestors,
            {
              href: `${catalogueViewHref(parent.route)}${
                parentSnapshot ? `?snapshot=${parentSnapshot}` : ""
              }`,
              label: parent.title,
            },
          ],
    id: target.entry.id,
    title: target.entry.title,
  };
}
