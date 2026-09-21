/** Route-scoped workspace evidence read from another page in one static deployment. */

import { readViewerWorkspace } from "../client/workspace_descriptor.js";
import {
  catalogueViewHref,
  type StaticDelivery,
} from "../navigation/delivery.js";
import { readShellDelivery } from "../shell/delivery.js";
import type { WorkspaceData } from "../shell/workspace_data.js";

import {
  readShellBootstrapState,
  resolveShellBootstrap,
  shellBootstrapWithDelivery,
  type ShellBootstrap,
} from "./bootstrap.js";

/** Inert destination-page reader available only to a hydrated static shell. */
export interface StaticWorkspaceEvidence {
  loadWorkspace(
    entry: WorkspaceData["entry"],
    signal: AbortSignal,
  ): Promise<WorkspaceData | undefined>;
}

/** Bind static route reads to the catalogue and finalized deployment being hydrated. */
export function staticWorkspaceEvidence(
  win: Window & typeof globalThis,
  installed: ShellBootstrap,
): StaticWorkspaceEvidence | undefined {
  const delivery = installed.context.delivery;
  if (
    !delivery ||
    installed.catalogue.deploymentId !== delivery.deploymentId ||
    typeof win.fetch !== "function" ||
    typeof win.DOMParser !== "function"
  )
    return;
  return {
    loadWorkspace: (entry, signal) =>
      loadWorkspace(win, installed, delivery, entry, signal),
  };
}

async function loadWorkspace(
  win: Window & typeof globalThis,
  installed: ShellBootstrap,
  installedDelivery: StaticDelivery,
  entry: WorkspaceData["entry"],
  signal: AbortSignal,
): Promise<WorkspaceData | undefined> {
  const requested = new URL(catalogueViewHref(entry.route), win.location.href);
  try {
    const response = await win.fetch(requested, {
      cache: "no-store",
      credentials: "omit",
      signal,
    });
    if (!response.ok || signal.aborted || !sameResponseUrl(response, requested))
      return;
    const html = await response.text();
    if (signal.aborted) return;
    const page = new win.DOMParser().parseFromString(html, "text/html");
    const delivery = readShellDelivery(page);
    if (
      !delivery ||
      !sameDeployment(delivery, installedDelivery) ||
      delivery.canonicalPath !== catalogueViewHref(entry.route)
    )
      return;
    const bootstrapValue = scriptValue(
      page,
      "script[data-mokly-shell-bootstrap]",
    );
    const workspaceValue = scriptValue(page, "script[data-workspace-data]");
    if (bootstrapValue === undefined || workspaceValue === undefined) return;
    const bootstrap = shellBootstrapWithDelivery(
      resolveShellBootstrap(
        readShellBootstrapState(bootstrapValue),
        installed.catalogue,
      ),
      delivery,
    );
    if (!sameStaticSource(bootstrap, installed, entry.route)) return;
    const workspace = readViewerWorkspace(workspaceValue, {
      base: installed.context.base,
      ...(installed.context.previewGeneration
        ? { previewGeneration: installed.context.previewGeneration }
        : {}),
    });
    if (
      workspace.entry.id !== entry.id ||
      workspace.entry.kind !== entry.kind ||
      workspace.entry.route !== entry.route
    )
      return;
    return workspace;
  } catch {
    return;
  }
}

function scriptValue(page: Document, selector: string): unknown {
  const scripts = page.querySelectorAll<HTMLScriptElement>(selector);
  if (scripts.length !== 1 || !scripts[0]?.textContent) return;
  return JSON.parse(scripts[0].textContent);
}

function sameResponseUrl(response: Response, requested: URL): boolean {
  const received = new URL(response.url, requested);
  const normalized = requested.pathname.endsWith(".html")
    ? requested.pathname.slice(0, -5)
    : requested.pathname;
  return (
    received.origin === requested.origin &&
    (received.pathname === requested.pathname ||
      received.pathname === normalized) &&
    received.search === "" &&
    received.hash === ""
  );
}

function sameDeployment(
  candidate: StaticDelivery,
  installed: StaticDelivery,
): boolean {
  const candidateIds = Object.keys(candidate.idRoutes);
  const installedIds = Object.keys(installed.idRoutes);
  return (
    candidate.schemaVersion === installed.schemaVersion &&
    candidate.deploymentId === installed.deploymentId &&
    candidate.comparisonUrl === installed.comparisonUrl &&
    candidateIds.length === installedIds.length &&
    candidateIds.every(
      (id) => candidate.idRoutes[id] === installed.idRoutes[id],
    )
  );
}

function sameStaticSource(
  candidate: ShellBootstrap,
  installed: ShellBootstrap,
  route: string,
): boolean {
  return (
    candidate.view.kind === "target" &&
    candidate.view.route === route &&
    candidate.catalogue.identity.id === installed.catalogue.identity.id &&
    candidate.catalogue.deploymentId === installed.catalogue.deploymentId &&
    candidate.catalogue.revision.content ===
      installed.catalogue.revision.content &&
    candidate.catalogue.revision.evidence ===
      installed.catalogue.revision.evidence &&
    candidate.catalogue.comparisonUrl === installed.catalogue.comparisonUrl &&
    candidate.context.base === installed.context.base &&
    candidate.context.comparisons === installed.context.comparisons &&
    candidate.context.previewGeneration ===
      installed.context.previewGeneration &&
    candidate.context.contentVersion === installed.context.contentVersion &&
    candidate.context.updateVersion === installed.context.updateVersion
  );
}
