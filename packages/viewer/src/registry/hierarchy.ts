import { FolderUses, folderLocation } from "./hierarchy_conflicts.js";
import {
  compareNavigationNodes,
  navPathKey,
  validNavLabel,
} from "./nav_paths.js";

/** Entry fields needed to analyze navigation paths. */
export interface HierarchyEntry {
  id: string;
  kind: string;
  navPath?: unknown;
  sourceRelativePath?: string;
  title: string;
  variantOf?: unknown;
}

/** A routed entry at the end of its authored navigation path. */
export interface HierarchyLeaf<T extends HierarchyEntry> {
  entry: T;
  key: string;
  kind: "entry";
  label: string;
}

/** A merged path prefix with at least one routed descendant. */
export interface HierarchyFolder<T extends HierarchyEntry> {
  children: HierarchyNode<T>[];
  key: string;
  kind: "folder";
  label: string;
  path: readonly string[];
}

/** A folder or routed entry in a section's current navigation tree. */
export type HierarchyNode<T extends HierarchyEntry> =
  HierarchyFolder<T> | HierarchyLeaf<T>;

/** A source-attributed violation of a current navigation path. */
export interface HierarchyIssue<T extends HierarchyEntry> {
  code: "invalid-nav-path" | "nav-path-conflict";
  entry: T;
  message: string;
}

/** Independent current trees and lookup tables for navigation and variants. */
export interface CatalogueHierarchy<T extends HierarchyEntry> {
  ancestorsById: ReadonlyMap<string, readonly string[]>;
  byId: ReadonlyMap<string, T>;
  roots: {
    pages: readonly HierarchyNode<T>[];
    components: readonly HierarchyNode<T>[];
  };
  variantsById: ReadonlyMap<string, readonly T[]>;
  variantParentById: ReadonlyMap<string, T>;
}

/** Hierarchy data plus any current-path violations. */
export interface HierarchyAnalysis<T extends HierarchyEntry> {
  hierarchy: CatalogueHierarchy<T>;
  issues: readonly HierarchyIssue<T>[];
}

interface Siblings<T extends HierarchyEntry> {
  children: HierarchyNode<T>[];
  folders: Map<string, HierarchyFolder<T>>;
}

function siblings<T extends HierarchyEntry>(): Siblings<T> {
  return { children: [], folders: new Map() };
}

/** Build one folder tree per section, validating labels and sibling conflicts. */
export function analyzeHierarchy<T extends HierarchyEntry>(
  entries: readonly T[],
): HierarchyAnalysis<T> {
  const issues: HierarchyIssue<T>[] = [];
  const pages = siblings<T>();
  const components = siblings<T>();
  const foldersByPath = {
    pages: new Map<string, Siblings<T>>(),
    components: new Map<string, Siblings<T>>(),
  };
  const byId = new Map<string, T>();
  const ancestorsById = new Map<string, readonly string[]>();
  const variantsById = new Map<string, T[]>();
  const variantParentById = new Map<string, T>();
  const uses = new FolderUses<T>();
  const pendingLeaves: {
    entry: T;
    siblings: Siblings<T>;
    section: "pages" | "components";
    parent: readonly string[];
  }[] = [];

  for (const entry of entries)
    if (!byId.has(entry.id)) byId.set(entry.id, entry);
  for (const entry of entries) {
    if (byId.get(entry.id) !== entry) continue;
    const path = entry.navPath === undefined ? [] : entry.navPath;
    const parent =
      typeof entry.variantOf === "string"
        ? byId.get(entry.variantOf)
        : undefined;
    const parentPath = parent?.navPath;
    if (
      parent &&
      (path === parentPath ||
        (Array.isArray(path) &&
          Array.isArray(parentPath) &&
          path.length === parentPath.length &&
          path.every((label, index) => label === parentPath[index]))) &&
      (!Array.isArray(path) || path.some((label) => !validNavLabel(label)))
    )
      continue;
    if (!Array.isArray(path)) {
      issues.push({
        code: "invalid-nav-path",
        entry,
        message: `entry ${entry.id} navPath index -1 has invalid label ${String(path)}`,
      });
      continue;
    }
    const invalid = path.flatMap((label: unknown, index: number) =>
      validNavLabel(label)
        ? []
        : [
            {
              code: "invalid-nav-path" as const,
              entry,
              message: `entry ${entry.id} navPath index ${index} has invalid label ${JSON.stringify(label) ?? String(label)}`,
            },
          ],
    );
    issues.push(...invalid);
    if (invalid.length) continue;
    const labels = path as string[];
    ancestorsById.set(entry.id, [...labels]);
    if (typeof entry.variantOf === "string") {
      const parent = byId.get(entry.variantOf);
      if (parent) {
        variantParentById.set(entry.id, parent);
        variantsById.set(parent.id, [
          ...(variantsById.get(parent.id) ?? []),
          entry,
        ]);
      }
      continue;
    }
    const section = entry.kind === "component" ? "components" : "pages";
    const root = section === "components" ? components : pages;
    const indexed = foldersByPath[section];
    let current = root;
    const prefix: string[] = [];
    for (const label of labels) {
      uses.record(section, prefix, label, entry);
      prefix.push(label);
      const pathKey = navPathKey(prefix);
      let folder = current.folders.get(label);
      if (!folder) {
        folder = {
          kind: "folder",
          label,
          key: pathKey,
          path: [...prefix],
          children: [],
        };
        current.folders.set(label, folder);
        current.children.push(folder);
        indexed.set(pathKey, siblings<T>());
      }
      current = indexed.get(pathKey)!;
    }
    pendingLeaves.push({
      entry,
      siblings: current,
      section,
      parent: labels,
    });
  }

  issues.push(...uses.issues());
  pendingLeaves.sort(({ entry: left }, { entry: right }) =>
    left.id < right.id ? -1 : left.id > right.id ? 1 : 0,
  );
  for (const { entry, siblings: current, section, parent } of pendingLeaves) {
    if (typeof entry.title !== "string") continue;
    const folder = uses.matchingFolder(section, parent, entry.title);
    if (folder !== undefined) {
      issues.push({
        code: "nav-path-conflict",
        entry,
        message: `leaf ${entry.id} label ${JSON.stringify(entry.title)} conflicts with folder label ${JSON.stringify(folder)} ${folderLocation(section, parent)}; append the folder label ${JSON.stringify(folder)} to the leaf's navPath`,
      });
      continue;
    }
    current.children.push({
      kind: "entry",
      entry,
      key: entry.id,
      label: entry.title,
    });
  }

  for (const [pathKey, children] of foldersByPath.pages) {
    const folder = findFolder(pages, foldersByPath.pages, pathKey);
    if (folder) folder.children = sortNodes(children.children);
  }
  for (const [pathKey, children] of foldersByPath.components) {
    const folder = findFolder(components, foldersByPath.components, pathKey);
    if (folder) folder.children = sortNodes(children.children);
  }
  return {
    hierarchy: {
      ancestorsById,
      byId,
      roots: {
        pages: sortNodes(pages.children),
        components: sortNodes(components.children),
      },
      variantsById,
      variantParentById,
    },
    issues,
  };
}

function findFolder<T extends HierarchyEntry>(
  root: Siblings<T>,
  indexed: ReadonlyMap<string, Siblings<T>>,
  key: string,
): HierarchyFolder<T> | undefined {
  const labels = key.split("/");
  const parent =
    labels.length === 1 ? root : indexed.get(navPathKey(labels.slice(0, -1)));
  return parent?.folders.get(labels.at(-1) ?? "");
}

function sortNodes<T extends HierarchyEntry>(
  nodes: readonly HierarchyNode<T>[],
): HierarchyNode<T>[] {
  return [...nodes].sort(compareNavigationNodes);
}
