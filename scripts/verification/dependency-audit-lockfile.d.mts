import type {
  AuditException,
  AuditLockfileEntry,
} from "./dependency-audit-evaluation.mjs";

/** Return whether a JSON value is an object, rather than an array or null. */
export function isRecord(value: unknown): value is Record<string, unknown>;

/** Accept normalized npm package names, including scoped names. */
export function isPackageName(value: unknown): value is string;

/** Accept canonical relative lockfile install locations. */
export function isInstallLocation(value: unknown): value is string;

/** Name at the end of a normalized install location. */
export function installPackageName(location: string): string | undefined;

/** All dependency scopes checked by reviewed paths. */
export const DEPENDENCY_SCOPES: readonly [
  "dependencies",
  "devDependencies",
  "optionalDependencies",
  "peerDependencies",
];

/** Local package entries include workspaces and linked native packages. */
export function workspaceLocations(
  packages: Readonly<Record<string, AuditLockfileEntry>>,
): string[];

/** Resolve an edge through the nearest installed node_modules entry. */
export function resolveDependency(
  packages: Readonly<Record<string, AuditLockfileEntry>>,
  owner: string,
  name: string,
): string | undefined;

/** Reject missing package inventories and malformed dependency maps. */
export function lockfileErrors(lockfile: unknown): string[];

/** Prove the exact dev-only path and every inner package's sole dependent. */
export function exceptionPathErrors(
  exception: AuditException,
  nodes: readonly string[],
  packages: Readonly<Record<string, AuditLockfileEntry>>,
): string[];
