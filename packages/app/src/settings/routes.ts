import { settingsPath } from "../navigation/paths";
import { removeQueryKeys, setQueryValue } from "../navigation/query";

import type { SurfaceId } from "./panes";

const settingsKeys = new Set(["settings"]);

/** The keys that address the open dialog: its pane and its project. */
const dialogKeys = new Set(["settings", "settingsProject"]);

/** The workspace and project a settings surface is opened against. */
export interface SettingsScopeSlugs {
  workspaceSlug?: string;
  projectSlug?: string;
}

/**
 * The durable route form of one pane. Share and help links use it because it
 * works on every surface; the desktop dialog turns it into `?settings=`. A
 * pane whose scope lacks a slug that it needs has no address yet, and the
 * caller says what stands in: a rail entry waits disabled, with no link, and a
 * redirect names the page it lands on instead.
 */
export function paneRoute(
  pane: SurfaceId,
  scope: SettingsScopeSlugs,
): string | undefined {
  if (pane === "sections" || pane === "account") return settingsPath({ pane });
  const { workspaceSlug, projectSlug } = scope;
  if (!workspaceSlug) return undefined;
  if (
    pane === "workspace" ||
    pane === "github" ||
    pane === "members" ||
    pane === "billing"
  ) {
    return settingsPath({ pane, workspaceSlug });
  }
  return projectSlug
    ? settingsPath({ pane, workspaceSlug, projectSlug })
    : undefined;
}

/**
 * The query form the desktop dialog is addressed with, over the page beneath.
 * The page's own keys are kept: the dialog is drawn over the viewer rather than
 * instead of it, so opening settings must not quietly discard the selection the
 * reader is looking at. An address that already carries a query, such as the
 * install step's workspace, keeps it, and its keys win over carried ones.
 */
export function paneQuery(
  address: string,
  pane: SurfaceId,
  search = "",
): string {
  const split = address.indexOf("?");
  const pathname = split === -1 ? address : address.slice(0, split);
  const own = split === -1 ? "" : address.slice(split + 1);
  const carried = removeQueryKeys(
    search,
    new Set(new URLSearchParams(own).keys()),
  );
  const query = setQueryValue(
    [own, carried].filter((part) => part.length > 0).join("&"),
    "settings",
    pane === "sections" ? "" : pane,
  );
  return `${pathname}?${query}`;
}

/**
 * Carry the open dialog onto the address a page hands the reader on to, so
 * the pane stays open over the next page. Only the dialog's own keys travel,
 * byte for byte, and the address's own keys win: the next page does not
 * inherit the rest of this page's query.
 */
export function carrySettings(address: string, search: string): string {
  const split = address.indexOf("?");
  const own = split === -1 ? "" : address.slice(split + 1);
  const taken = new Set(new URLSearchParams(own).keys());
  const left = new Set(
    [...new URLSearchParams(search).keys()].filter(
      (key) => !dialogKeys.has(key) || taken.has(key),
    ),
  );
  const carried = removeQueryKeys(search, left);
  if (carried.length === 0) return address;
  const joiner = split === -1 ? "?" : own.length > 0 ? "&" : "";
  return address + joiner + carried;
}

/** The address the dialog is drawn over: this page without the dialog on it. */
export function pageBeneath(pathname: string, search = ""): string {
  const rest = queryWithoutSettings(search);
  return rest.length > 0 ? `${pathname}?${rest}` : pathname;
}

/** The query a compact settings route carries without the desktop dialog key. */
export function queryWithoutSettings(search: string): string {
  return removeQueryKeys(search, settingsKeys);
}
