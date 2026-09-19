/** Private live-host descriptor and source-identity validation. */

import type { CatalogueReadModel } from "../catalogue/types.js";
import { canonicalJson } from "../components/data.js";
import type { RenderCapability } from "../components/render_types.js";
import type { ShellContext } from "../shell/context.js";
import type { WorkspaceData } from "../shell/workspace_data.js";

import { readViewerWorkspace } from "./workspace_descriptor.js";

/** Stable source identity plus the revisions seen by one shell transition. */
export interface ViewerCapabilitySource {
  base: string;
  catalogueId: string;
  contentRevision: number;
  evidenceRevision: number;
  previewGeneration?: string;
  renderGeneration?: string;
  updateVersion: number;
}

/** Current routed request; consumers recreate it after route or revision adoption. */
export interface ViewerCapabilityRequest {
  route: string | null;
  source: ViewerCapabilitySource;
}

/** Private server-to-CLI bootstrap kept outside public catalogue JSON. */
export interface ViewerCapabilityDescriptor {
  renderCapability?: RenderCapability;
  schemaVersion: 1;
  source: ViewerCapabilitySource;
  workspace?: WorkspaceData;
}

/** Build a private live descriptor; static delivery deliberately returns nothing. */
export function viewerCapabilityDescriptor(
  catalogue: CatalogueReadModel,
  context: ShellContext,
  workspace?: WorkspaceData,
): ViewerCapabilityDescriptor | undefined {
  if (context.delivery || context.contentVersion === undefined) return;
  if (
    context.contentVersion !== catalogue.revision.content ||
    !positiveVersion(context.updateVersion)
  )
    throw new Error("Live viewer capability revisions are inconsistent.");
  if (
    context.renderCapability &&
    context.previewGeneration &&
    context.previewGeneration !== context.renderCapability.generation
  )
    throw new Error("Live viewer render generations are inconsistent.");
  const source: ViewerCapabilitySource = {
    base: context.base,
    catalogueId: catalogue.identity.id,
    contentRevision: catalogue.revision.content,
    evidenceRevision: catalogue.revision.evidence,
    updateVersion: context.updateVersion,
    ...(context.previewGeneration
      ? { previewGeneration: context.previewGeneration }
      : {}),
    ...(context.renderCapability
      ? { renderGeneration: context.renderCapability.generation }
      : {}),
  };
  const privateWorkspace = workspace
    ? workspaceWithoutRenderCapability(workspace)
    : undefined;
  if (privateWorkspace) readViewerWorkspace(privateWorkspace, source);
  return {
    schemaVersion: 1,
    source,
    ...(context.renderCapability
      ? { renderCapability: context.renderCapability }
      : {}),
    ...(privateWorkspace ? { workspace: privateWorkspace } : {}),
  };
}

/** Validate the private JSON descriptor before its token reaches a transport. */
export function readViewerCapabilityDescriptor(
  value: unknown,
): ViewerCapabilityDescriptor {
  if (!record(value) || value["schemaVersion"] !== 1)
    throw new Error("Invalid live viewer capability descriptor.");
  const source = readSource(value["source"]);
  const renderCapability = readRenderCapability(
    value["renderCapability"],
    source,
  );
  const workspace = readWorkspace(value["workspace"], source);
  return {
    schemaVersion: 1,
    source,
    ...(renderCapability ? { renderCapability } : {}),
    ...(workspace ? { workspace } : {}),
  };
}

/** Serialize private bootstrap JSON without allowing an inline-script escape. */
export function serializeViewerCapabilityDescriptor(
  descriptor: ViewerCapabilityDescriptor,
): string {
  return canonicalJson(descriptor).replaceAll("<", "\\u003c");
}

/** Bind the latest source revision to the currently routed entry. */
export function viewerCapabilityRequest(
  source: ViewerCapabilitySource,
  route: string | null,
): ViewerCapabilityRequest {
  return { route, source };
}

/** Confirm that a current request still belongs to the installed live source. */
export function viewerCapabilityRequestMatches(
  installed: ViewerCapabilitySource,
  request: ViewerCapabilityRequest,
): boolean {
  const current = request.source;
  return (
    sameStableSource(installed, current) &&
    current.evidenceRevision >= installed.evidenceRevision &&
    current.updateVersion >= installed.updateVersion
  );
}

/** Compare every field when binding a host object to its SSR descriptor. */
export function viewerCapabilitySourceEquals(
  left: ViewerCapabilitySource,
  right: ViewerCapabilitySource,
): boolean {
  return (
    sameStableSource(left, right) &&
    left.evidenceRevision === right.evidenceRevision &&
    left.updateVersion === right.updateVersion
  );
}

function readRenderCapability(
  value: unknown,
  source: ViewerCapabilitySource,
): RenderCapability | undefined {
  if (value === undefined) {
    if (source.renderGeneration)
      throw new Error("Invalid live viewer render capability.");
    return;
  }
  if (
    !record(value) ||
    typeof value["generation"] !== "string" ||
    !/^[a-f0-9]{32}$/.test(value["generation"]) ||
    typeof value["token"] !== "string" ||
    !/^[a-f0-9]{64}$/.test(value["token"]) ||
    source.renderGeneration !== value["generation"]
  )
    throw new Error("Invalid live viewer render capability.");
  return { generation: value["generation"], token: value["token"] };
}

function readWorkspace(
  value: unknown,
  source: ViewerCapabilitySource,
): WorkspaceData | undefined {
  if (value === undefined) return;
  return readViewerWorkspace(value, source);
}

function workspaceWithoutRenderCapability(data: WorkspaceData): WorkspaceData {
  const { renderCapability: _renderCapability, ...workspace } = data;
  return workspace;
}

function readSource(value: unknown): ViewerCapabilitySource {
  if (!record(value)) throw new Error("Invalid live viewer capability source.");
  const previewGeneration = value["previewGeneration"];
  const renderGeneration = value["renderGeneration"];
  if (
    typeof value["base"] !== "string" ||
    typeof value["catalogueId"] !== "string" ||
    !/^[a-f0-9]{64}$/.test(value["catalogueId"]) ||
    !nonnegativeVersion(value["contentRevision"]) ||
    !nonnegativeVersion(value["evidenceRevision"]) ||
    !positiveVersion(value["updateVersion"]) ||
    (previewGeneration !== undefined &&
      (typeof previewGeneration !== "string" ||
        !/^[a-f0-9]{32}$/.test(previewGeneration))) ||
    (renderGeneration !== undefined &&
      (typeof renderGeneration !== "string" ||
        !/^[a-f0-9]{32}$/.test(renderGeneration))) ||
    (previewGeneration !== undefined &&
      renderGeneration !== undefined &&
      previewGeneration !== renderGeneration)
  )
    throw new Error("Invalid live viewer capability source.");
  return {
    base: value["base"],
    catalogueId: value["catalogueId"],
    contentRevision: value["contentRevision"],
    evidenceRevision: value["evidenceRevision"],
    updateVersion: value["updateVersion"],
    ...(previewGeneration ? { previewGeneration } : {}),
    ...(renderGeneration ? { renderGeneration } : {}),
  };
}

function sameStableSource(
  left: ViewerCapabilitySource,
  right: ViewerCapabilitySource,
): boolean {
  return (
    left.base === right.base &&
    left.catalogueId === right.catalogueId &&
    left.contentRevision === right.contentRevision &&
    left.previewGeneration === right.previewGeneration &&
    left.renderGeneration === right.renderGeneration
  );
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function nonnegativeVersion(value: unknown): value is number {
  return Number.isSafeInteger(value) && (value as number) >= 0;
}

function positiveVersion(value: unknown): value is number {
  return nonnegativeVersion(value) && value > 0;
}
