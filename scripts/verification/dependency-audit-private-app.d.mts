import type {
  AuditException,
  AuditLockfileEntry,
  AuditWorkspaces,
} from "./dependency-audit-evaluation.mjs";

/** Prove a private app path and exclude every published production closure. */
export function privateAppPathErrors(
  exception: AuditException,
  nodes: readonly string[],
  packages: Readonly<Record<string, AuditLockfileEntry>>,
  workspaces: AuditWorkspaces,
): string[];
