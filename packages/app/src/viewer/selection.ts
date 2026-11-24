import { removeQueryKeys } from "../navigation/address";
import type { Query } from "../navigation/address";

import type {
  ViewerScheme,
  ViewerSelection,
  ViewerView,
  ViewerViewport,
} from "./host";
import { isScreenPath } from "./screen-path";

/** The overlays a viewer slot opens; an absent value means every one is shut. */
export type ViewerPanel = "projects" | "switcher" | "history" | "share";

/** The viewer's complete URL state: what the stage shows, and what is over it. */
export interface ViewerUrlState {
  selection: ViewerSelection;
  panel?: ViewerPanel;
}

/** What the reader's own preference supplies when the URL names no scheme. */
export interface SelectionDefaults {
  scheme: ViewerScheme;
  /**
   * Whether this address has a publication a panel could act on. A panel that
   * needs one is not a value this address can honour, so it is corrected away
   * rather than opened over nothing.
   */
  publication?: boolean;
}

const views: readonly ViewerView[] = ["all", "changes"];
const viewports: readonly ViewerViewport[] = ["desktop", "mobile", "both"];
const schemes: readonly ViewerScheme[] = ["light", "dark"];
const panels: readonly ViewerPanel[] = [
  "projects",
  "switcher",
  "history",
  "share",
];

/** The panels that can only act on a publication the address resolved. */
const publicationPanels: readonly ViewerPanel[] = ["share"];

/** The grammar of a package snapshot identity: 64 lowercase hex digits. */
const snapshotIdentity = /^[0-9a-f]{64}$/;

/**
 * Keys an earlier viewer release wrote that no surface reads any more. Viewer
 * 0.5.0 selects a variant by its own entry path, which only the catalogue knows,
 * so an old `variantId` is dropped rather than turned into a guessed path.
 */
const retiredKeys = ["variantId"] as const;

function needsPublication(panel: ViewerPanel, defaults: SelectionDefaults) {
  return publicationPanels.includes(panel) && defaults.publication === false;
}

/** The one value a key carries, or nothing when it is absent or repeated. */
function single(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return undefined;
  return value === undefined || value.length === 0 ? undefined : value;
}

function member<T extends string>(
  allowed: readonly T[],
  value: string | undefined,
): T | undefined {
  return allowed.find((candidate) => candidate === value);
}

/**
 * Whether the URL's own value for a key survived validation. A key the reader
 * never supplied is not a correction; a key they supplied that this
 * publication cannot honour is, which is what the route replaces.
 */
function kept(raw: string | string[] | undefined, resolved: unknown): boolean {
  if (raw === undefined) return true;
  if (Array.isArray(raw)) return false;
  if (raw.length === 0) return false;
  return raw === resolved;
}

function readTags(raw: string | string[] | undefined): {
  tags: readonly string[];
  kept: boolean;
} {
  if (raw === undefined) return { tags: [], kept: true };
  const supplied = Array.isArray(raw) ? raw : [raw];
  const tags = supplied.map((tag) => tag.toLowerCase());
  const valid =
    supplied.length > 0 &&
    supplied.every((tag) => tag.length > 0 && !/\s/.test(tag)) &&
    new Set(tags).size === tags.length;
  return {
    tags: valid ? tags : [],
    kept: valid && supplied.every((tag, index) => tag === tags[index]),
  };
}

/**
 * The snapshot the address names, when it can name one: a single 64-hex
 * identity beside a screen. The package refuses any other value outright,
 * which would cost the reader the whole viewer, so it is corrected away here;
 * whether the record exists in this catalogue is the package's to answer.
 */
function readSnapshot(
  raw: string | string[] | undefined,
  screen: string | undefined,
): string | undefined {
  const value = single(raw);
  return screen !== undefined &&
    value !== undefined &&
    snapshotIdentity.test(value)
    ? value
    : undefined;
}

/**
 * Read the viewer's state from one route's query, validated against the
 * publication the route resolved. A syntactically invalid cloud value falls
 * back to the default, and `corrected` says so, which is the route's signal to
 * replace the address. Routed-entry and snapshot membership belong to the
 * package: cloud screen metadata covers only the narrower Share capability.
 */
export function readViewerState(
  query: Query,
  defaults: SelectionDefaults,
): { state: ViewerUrlState; corrected: boolean } {
  const view = member(views, single(query.view)) ?? "all";
  const viewport = member(viewports, single(query.viewport)) ?? "both";
  const scheme = member(schemes, single(query.scheme)) ?? defaults.scheme;
  const search = single(query.search) ?? "";
  const read = readTags(query.tag);
  const named = member(panels, single(query.panel));
  const panel =
    named !== undefined && !needsPublication(named, defaults)
      ? named
      : undefined;
  const namedScreen = single(query.catalogueScreen);
  const screen =
    namedScreen !== undefined && isScreenPath(namedScreen)
      ? namedScreen
      : undefined;
  const snapshotId = readSnapshot(query.catalogueSnapshot, screen);
  const corrected = !(
    kept(query.view, view) &&
    kept(query.viewport, viewport) &&
    kept(query.scheme, scheme) &&
    kept(query.panel, panel) &&
    kept(query.catalogueScreen, screen) &&
    kept(query.catalogueSnapshot, snapshotId) &&
    retiredKeys.every((key) => query[key] === undefined) &&
    kept(query.search, search) &&
    read.kept
  );
  return {
    state: {
      selection: {
        view,
        screen,
        ...(snapshotId === undefined ? {} : { snapshotId }),
        viewport,
        scheme,
        search,
        tags: read.tags,
      },
      panel,
    },
    corrected,
  };
}

/**
 * The address for one viewer state. A value the reader has not moved away from
 * is left out, so the address names the reader's own choices and nothing else;
 * the scheme default is their preference, which is theirs rather than a value
 * to write into a link somebody else opens.
 */
export function viewerHref(
  pathname: string,
  state: ViewerUrlState,
  defaults: SelectionDefaults,
  search = "",
): string {
  // Each surface edits only the keys it owns when it writes a query over the
  // address it is already on: the dialog's `paneQuery` keeps the viewer's keys
  // when it opens, and this keeps the dialog's when the viewer corrects a
  // value. A key neither owns survives both.
  const query = new URLSearchParams(search);
  const { selection } = state;
  const put = (key: string, value: string | undefined) =>
    value === undefined ? query.delete(key) : query.set(key, value);
  put("view", selection.view === "all" ? undefined : selection.view);
  // The same key the API mints and the check run links: one name for the
  // catalogue screen, on every address that carries one.
  put("catalogueScreen", selection.screen);
  put("catalogueSnapshot", selection.snapshotId);
  for (const key of retiredKeys) query.delete(key);
  put(
    "viewport",
    selection.viewport === "both" ? undefined : selection.viewport,
  );
  put(
    "scheme",
    selection.scheme === defaults.scheme ? undefined : selection.scheme,
  );
  put("search", selection.search.length === 0 ? undefined : selection.search);
  query.delete("tag");
  for (const tag of selection.tags) query.append("tag", tag);
  put("panel", state.panel);
  const written = query.toString();
  return written.length > 0 ? `${pathname}?${written}` : pathname;
}

/**
 * The query keys a resolution leaves behind.
 *
 * `branch` names the reference the address asked for, and the address that
 * replaces it names the publication instead. `screen` is the key React
 * Navigation reserves for navigating into a nested navigator: the application
 * neither reads nor writes it, and this is the one place a query the reader
 * supplied crosses into a router navigation, so it is where that property is
 * enforced rather than only documented.
 */
const droppedKeys = new Set(["branch", "screen"]);

/**
 * The query a reference alias hands on to the publication it resolved to.
 *
 * The resolution is a router navigation rather than a write, so the query it
 * arrives with is the one built here. Everything the reader's link named
 * travels — the settings pane it asked for, the viewport and scheme it pinned —
 * because a reader who opens a link with the account dialog named expects the
 * dialog. Only the keys above are left behind.
 */
export function carriedQuery(search: string): string {
  return removeQueryKeys(search, droppedKeys);
}

/**
 * Replace a reference alias with its publication while preserving every query
 * byte the resolution does not own. Invalid viewer state is the one exception:
 * its normal correction deliberately writes canonical values.
 */
export function referenceResolutionHref(
  pathname: string,
  search: string,
  state: ViewerUrlState,
  defaults: SelectionDefaults,
  corrected: boolean,
): string {
  const carried = carriedQuery(search);
  const rawSearch = carried.length > 0 ? `?${carried}` : "";
  return corrected
    ? viewerHref(pathname, state, defaults, rawSearch)
    : pathname + rawSearch;
}
