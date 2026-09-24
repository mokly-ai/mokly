import { isSafeCatalogueRoute, isSafeRepositoryPath } from "@mokly/viewer/data";
import type { ManifestV5 } from "@mokly/viewer/data";

import {
  parseBaselineCatalogue,
  type BaselineCatalogue,
} from "../baseline/catalogue.js";
import type { BaselineSelection } from "../review/repository.js";

import type { ComponentChangeSnapshot } from "./component_changes.js";
import type {
  RuntimeMessage,
  RuntimeStartupMessage,
} from "./controls/runtime_ipc.js";
/** Typed watched-server updates crossing the parent/child IPC boundary. */

/**
 * Live comparison state. `preparing` precedes `pending` only while the pinned
 * baseline is actually rebuilt; a cache hit and a blob reader skip it.
 */
export type ChangesStatus = "preparing" | "pending" | "ready" | "unavailable";

/** Evidence updates retain the current rendered content and user interactions. */
export type CatalogueUpdateKind = "content" | "evidence";

/** Mutable running-server state published before clients refresh. */
export interface CatalogueUpdate {
  assetClosure?: readonly string[];
  /** Defaults to content, requiring clients to refresh their rendered documents. */
  kind?: CatalogueUpdateKind;
  /** Omit to retain status unless the update replaces change evidence. */
  changesStatus?: ChangesStatus;
  /** Omit to retain state, use `null` when changed-route detection is unavailable. */
  changedRoutes?: readonly string[] | null;
  /** Omit to retain evidence, use `null` while fresh classification is unavailable. */
  componentChanges?: ComponentChangeSnapshot | null;
  /** Omit to allocate the next monotonically increasing update version. */
  version?: number;
}

/** Parent-to-child update command with an explicit changed-route snapshot. */
export interface ChildUpdateMessage {
  assetClosure?: readonly string[];
  /** Omit to retain the reader; null revokes it while the parent prepares. */
  baselineCommit?: string | null;
  baselineSelection?: BaselineSelection;
  baselineDescriptor?: BaselineCatalogue;
  kind?: CatalogueUpdateKind;
  changesStatus?: ChangesStatus;
  changedRoutes: readonly string[] | null;
  componentChanges: ComponentChangeSnapshot | null;
  type: "update";
  version: number;
}

export interface CatalogueCompleteMessage {
  type: "catalogue-complete";
  manifest: ManifestV5;
  generation: string;
  version: number;
}

/** Child-to-parent runtime diagnostic kept separate from command envelopes. */
export interface ChildDiagnosticMessage {
  readonly message: string;
  readonly type: "diagnostic";
}

/** Validate one bounded diagnostic from the supervised child. */
export function parseChildDiagnosticMessage(
  value: unknown,
): ChildDiagnosticMessage | undefined {
  if (
    !value ||
    typeof value !== "object" ||
    !("type" in value) ||
    value.type !== "diagnostic" ||
    !("message" in value) ||
    typeof value.message !== "string" ||
    value.message.length === 0 ||
    Buffer.byteLength(value.message) > 65_536
  )
    return;
  return { type: "diagnostic", message: value.message };
}

/** Validate the envelope here; the active server validates matching manifest contents. */
export function parseCatalogueCompleteMessage(
  value: unknown,
): CatalogueCompleteMessage | undefined {
  if (
    !value ||
    typeof value !== "object" ||
    !("type" in value) ||
    value.type !== "catalogue-complete"
  )
    return;
  const candidate = value as Partial<CatalogueCompleteMessage>;
  if (
    typeof candidate.generation !== "string" ||
    !/^[a-f0-9]{32}$/.test(candidate.generation) ||
    !Number.isSafeInteger(candidate.version) ||
    (candidate.version ?? 0) <= 0 ||
    !candidate.manifest ||
    typeof candidate.manifest !== "object" ||
    (candidate.manifest.schemaVersion !== 5 &&
      candidate.manifest.schemaVersion !== 6)
  )
    return;
  return candidate as CatalogueCompleteMessage;
}

/** Commands accepted by the watched server child. */
export type ChildCommand =
  | CatalogueCompleteMessage
  | ChildUpdateMessage
  | RuntimeMessage
  | RuntimeStartupMessage
  | { type: "shutdown" };

/** Create an immutable IPC update payload from the latest route computation. */
export function childUpdateMessage(
  version: number,
  changedRoutes: readonly string[] | undefined,
  componentChanges?: ComponentChangeSnapshot,
  changesStatus?: ChangesStatus,
  kind?: CatalogueUpdateKind,
  baselineCommit?: string | null,
  baselineSelection?: BaselineSelection,
  baselineDescriptor?: BaselineCatalogue,
  assetClosure?: readonly string[],
): ChildUpdateMessage {
  return {
    ...(baselineCommit !== undefined ? { baselineCommit } : {}),
    ...(baselineSelection ? { baselineSelection } : {}),
    ...(baselineDescriptor ? { baselineDescriptor } : {}),
    ...(assetClosure ? { assetClosure: [...assetClosure] } : {}),
    ...(kind ? { kind } : {}),
    ...(changesStatus ? { changesStatus } : {}),
    changedRoutes: changedRoutes ? [...changedRoutes] : null,
    componentChanges: componentChanges ?? null,
    type: "update",
    version,
  };
}

/** Parse an untrusted IPC value as one complete watched-server update. */
export function parseChildUpdateMessage(
  value: unknown,
): ChildUpdateMessage | undefined {
  if (
    typeof value !== "object" ||
    value === null ||
    (value as { type?: unknown }).type !== "update"
  ) {
    return undefined;
  }
  const candidate = value as {
    baselineCommit?: unknown;
    baselineSelection?: unknown;
    baselineDescriptor?: unknown;
    assetClosure?: unknown;
    kind?: unknown;
    changesStatus?: unknown;
    changedRoutes?: unknown;
    componentChanges?: unknown;
    version?: unknown;
  };
  if (
    (candidate.baselineCommit !== undefined &&
      candidate.baselineCommit !== null &&
      (typeof candidate.baselineCommit !== "string" ||
        !/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/.test(candidate.baselineCommit))) ||
    (typeof candidate.baselineCommit === "string" &&
      candidate.baselineSelection !== "blobs" &&
      candidate.baselineSelection !== "rebuild") ||
    (typeof candidate.baselineCommit === "string" &&
      !parseBaselineCatalogue(
        candidate.baselineDescriptor,
        candidate.baselineCommit,
      )) ||
    (typeof candidate.baselineCommit !== "string" &&
      (candidate.baselineSelection !== undefined ||
        candidate.baselineDescriptor !== undefined)) ||
    (candidate.assetClosure !== undefined &&
      (!Array.isArray(candidate.assetClosure) ||
        !candidate.assetClosure.every(
          (route: unknown) =>
            typeof route === "string" &&
            isSafeRepositoryPath(route) &&
            !route.startsWith(".generated/"),
        ))) ||
    !Number.isSafeInteger(candidate.version) ||
    (candidate.version as number) <= 0 ||
    !isChangedRoutes(candidate.changedRoutes) ||
    !isComponentChanges(candidate.componentChanges) ||
    (candidate.kind !== undefined &&
      candidate.kind !== "content" &&
      candidate.kind !== "evidence") ||
    (candidate.changesStatus !== undefined &&
      !isChangesStatus(candidate.changesStatus))
  ) {
    return undefined;
  }
  return {
    ...(candidate.baselineCommit !== undefined
      ? { baselineCommit: candidate.baselineCommit }
      : {}),
    ...(candidate.baselineSelection
      ? { baselineSelection: candidate.baselineSelection as BaselineSelection }
      : {}),
    ...(typeof candidate.baselineCommit === "string"
      ? {
          baselineDescriptor: parseBaselineCatalogue(
            candidate.baselineDescriptor,
            candidate.baselineCommit,
          )!,
        }
      : {}),
    ...(candidate.assetClosure !== undefined
      ? { assetClosure: candidate.assetClosure as string[] }
      : {}),
    ...(candidate.kind ? { kind: candidate.kind } : {}),
    ...(candidate.changesStatus
      ? { changesStatus: candidate.changesStatus }
      : {}),
    changedRoutes: candidate.changedRoutes,
    componentChanges: candidate.componentChanges,
    type: "update",
    version: candidate.version as number,
  };
}

function isChangesStatus(value: unknown): value is ChangesStatus {
  return (
    value === "preparing" ||
    value === "pending" ||
    value === "ready" ||
    value === "unavailable"
  );
}

function isComponentChanges(
  value: unknown,
): value is ComponentChangeSnapshot | null {
  if (value === null) return true;
  if (typeof value !== "object" || value === null || !("baseline" in value))
    return false;
  const snapshot = value as {
    baseline?: unknown;
    changedRoutes?: unknown;
    result?: unknown;
  };
  return (
    typeof snapshot.baseline === "object" &&
    snapshot.baseline !== null &&
    (snapshot.changedRoutes === undefined ||
      (isChangedRoutes(snapshot.changedRoutes) &&
        snapshot.changedRoutes !== null)) &&
    (snapshot.result === undefined ||
      (typeof snapshot.result === "object" && snapshot.result !== null))
  );
}

function isChangedRoutes(value: unknown): value is readonly string[] | null {
  return (
    value === null ||
    (Array.isArray(value) &&
      value.every(
        (route) => typeof route === "string" && isSafeCatalogueRoute(route),
      ))
  );
}
