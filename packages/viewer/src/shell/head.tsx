// The heading for a catalogue view uses the title, path, and folder
// ancestors from the shared hierarchy or removed entry baseline.

import type { ReactNode } from "react";

import { viewHref } from "../navigation/routes.js";

import {
  catalogueVariantParent,
  catalogueVariantParentEntry,
  type Catalogue,
} from "./catalogue.js";
import { structuredCrumbTrail, type CatalogueCrumb } from "./crumbs.js";
import { useOptionalShellStore } from "./store_context.js";
import type { RouteTarget } from "./target.js";

/** One crumb: a link to a folder's page, a folder reveal, or plain text. */
function Crumb(props: { item: CatalogueCrumb }) {
  const store = useOptionalShellStore();
  const { folder, href, label } = props.item;
  if (href !== undefined)
    return (
      <a className="mbk-crumb-link" href={href}>
        {label}
      </a>
    );
  if (folder === undefined) return label;
  return (
    <button
      className="mbk-crumb-link"
      data-crumb-folder={folder.path}
      onClick={() => store?.revealFolder(folder.section, folder.path)}
      type="button"
    >
      {label}
    </button>
  );
}

function Crumbs(props: { items: readonly CatalogueCrumb[] }) {
  return (
    <p aria-label="Catalogue location" className="mbk-crumbs">
      {props.items.map((item, index) => (
        <span key={`${item.label}-${index}`}>
          {index > 0 ? <span className="sep">›</span> : null}
          <Crumb item={item} />
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
 * Preview color scheme selection for catalogues that render dark fragments. It
 * chooses what a device screen shows, not the appearance of the interface
 * around it, which an embedding host supplies. The shell
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
      aria-label="Preview color scheme"
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
  path?: string | undefined;
}) {
  const store = useOptionalShellStore();
  return (
    <div className="mbk-screen-head">
      <div className="mbk-screen-head-copy">
        <Crumbs items={props.crumbs} />
        <div className="mbk-title-row">
          <h2>{props.heading}</h2>
          {props.path ? (
            <button
              aria-label={`Copy path ${props.path}`}
              className="mbk-pathchip"
              data-copy-path={props.path}
              onClick={() =>
                store?.copy(props.path ?? "", `Copied path ${props.path}`)
              }
              type="button"
            >
              {props.path}
            </button>
          ) : null}
          {props.status}
        </div>
      </div>
      {props.action}
    </div>
  );
}

/** The breadcrumb trail, path, and title for one resolved route target. */
export function targetHead(
  catalogue: Catalogue,
  target: RouteTarget,
): { crumbs: CatalogueCrumb[]; path: string; title: string } {
  const ancestors =
    catalogue.removedEntries
      .find(({ entry }) => entry.path === target.entry.path)
      ?.folderTitles.map((label) => ({ label })) ??
    structuredCrumbTrail(catalogue.hierarchy, target.entry.path);
  const parent = catalogueVariantParent(catalogue, target.entry);
  const parentEntry = catalogueVariantParentEntry(catalogue, target.entry);
  const parentSnapshot = parent
    ? catalogue.removedEntries.find(({ entry }) => entry.path === parent.path)
        ?.snapshotId
    : undefined;
  return {
    crumbs:
      parentEntry === undefined
        ? ancestors
        : [
            ...ancestors,
            {
              ...(parent
                ? {
                    href: `${viewHref(parent.path)}${
                      parentSnapshot ? `?snapshot=${parentSnapshot}` : ""
                    }`,
                  }
                : {}),
              label: parentEntry.title,
            },
          ],
    path: target.entry.path,
    title:
      target.entry.kind === "component" &&
      "variantOf" in target.entry &&
      target.entry.variantOf !== undefined &&
      parentEntry?.kind === "component"
        ? parentEntry.title
        : target.entry.title,
  };
}
