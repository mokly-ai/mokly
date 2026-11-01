// The heading for a catalogue view uses the title, path, and folder
// ancestors from the shared hierarchy or removed entry baseline.

import type { ReactNode } from "react";

import { ScreenHeader } from "@mokly/ui/screen-header";
import { SegmentedControl, type Segment } from "@mokly/ui/segmented-control";

import type { ViewerSelection } from "../host/types.js";
import { viewHref } from "../navigation/routes.js";

import type { Catalogue } from "./catalogue.js";
import {
  branchPoints,
  type VariantParentResolution,
} from "./catalogue_branch_point.js";
import { structuredCrumbTrail, type CatalogueCrumb } from "./crumbs.js";
import { useOptionalShellStore } from "./store_context.js";
import type { RouteTarget } from "./target.js";
import { variantHeading } from "./view_title.js";

const VIEWPORTS: readonly Segment<ViewerSelection["viewport"]>[] = [
  ["mobile", "Mobile"],
  ["desktop", "Desktop"],
  ["both", "Both"],
];

const SCHEMES: readonly Segment<ViewerSelection["colorScheme"]>[] = [
  ["light", "Light"],
  ["dark", "Dark"],
];

/** Viewport selection shown in the header of a screen route. */
export function ViewportSwitch() {
  const store = useOptionalShellStore();
  return (
    <SegmentedControl
      attribute="data-viewport-option"
      label="Viewport"
      mark="data-mokly-viewswitch"
      onChange={(value) => store?.selectViewport(value)}
      segments={VIEWPORTS}
      value={store?.state.selection.viewport ?? "both"}
    />
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
  return (
    <SegmentedControl
      attribute="data-color-scheme-option"
      label="Preview color scheme"
      mark="data-mokly-schemeswitch"
      onChange={(value) => store?.selectColorScheme(value)}
      segments={SCHEMES}
      value={store?.state.selection.colorScheme ?? "light"}
    />
  );
}

/**
 * The breadcrumb, title, and optional action rendered above a target view. A
 * folder crumb reveals its row in the navigation, and the path chip copies
 * the path and announces the copy.
 */
export function ScreenHead(props: {
  action?: ReactNode;
  status?: ReactNode;
  crumbs: readonly CatalogueCrumb[];
  heading: string;
  path?: string | undefined;
}) {
  const store = useOptionalShellStore();
  return (
    <ScreenHeader
      action={props.action}
      crumbs={props.crumbs}
      heading={props.heading}
      onCopyPath={(path) => store?.copy(path, `Copied path ${path}`)}
      onRevealFolder={({ folder }) => {
        if (folder) store?.revealFolder(folder.section, folder.path);
      }}
      path={props.path}
      status={props.status}
    />
  );
}

/**
 * The crumb for a variant's parent: an eligible current parent links to its
 * page, a removed parent to its retained snapshot, and a stored title is text.
 */
function parentCrumb(parent: VariantParentResolution): CatalogueCrumb {
  if (parent.source === "title") return { label: parent.title };
  const snapshot =
    parent.source === "removed" ? parent.record.snapshotId : undefined;
  return {
    href: `${viewHref(parent.entry.path)}${
      snapshot ? `?snapshot=${snapshot}` : ""
    }`,
    label: parent.entry.title,
  };
}

/**
 * The breadcrumb trail, path, and title for one resolved route target. A
 * component variant's heading is its parent's title, as on the parent's own
 * page, so its crumbs end at the folders; a screen variant's crumbs end in
 * its parent's title.
 */
export function targetHead(
  catalogue: Catalogue,
  target: RouteTarget,
): { crumbs: CatalogueCrumb[]; path: string; title: string } {
  const ancestors =
    catalogue.removedEntries
      .find(({ entry }) => entry.path === target.entry.path)
      ?.folderTitles.map((label) => ({ label })) ??
    structuredCrumbTrail(catalogue.hierarchy, target.entry.path);
  const heading = variantHeading(catalogue, target.entry);
  if (heading !== undefined)
    return { crumbs: ancestors, path: target.entry.path, title: heading };
  const parent = branchPoints(catalogue).parentOf(target.entry);
  return {
    crumbs: parent ? [...ancestors, parentCrumb(parent)] : ancestors,
    path: target.entry.path,
    title: target.entry.title,
  };
}
