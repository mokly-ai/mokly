import type { HierarchyEntry, HierarchyIssue } from "./hierarchy.js";
import { navConflictKey, navPathKey } from "./nav_paths.js";

type Section = "pages" | "components";

interface ParentUses<T extends HierarchyEntry> {
  firstLabels: Map<string, string>;
  path: readonly string[];
  spellings: Map<string, Map<string, Map<string, T>>>;
}

function lexical(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

/** Describe a sibling location without treating the root as an empty label. */
export function folderLocation(section: Section, path: readonly string[]) {
  const name = section === "pages" ? "Pages" : "Components";
  return path.length === 0
    ? `at the top of ${name}`
    : `under ${name} › ${path.join(" › ")}`;
}

/** Track every spelling and source before assigning folder conflicts. */
export class FolderUses<T extends HierarchyEntry> {
  private readonly parents: Record<Section, Map<string, ParentUses<T>>> = {
    pages: new Map(),
    components: new Map(),
  };

  record(
    section: Section,
    path: readonly string[],
    label: string,
    entry: T,
  ): void {
    const key = navPathKey(path);
    let parent = this.parents[section].get(key);
    if (!parent) {
      parent = {
        firstLabels: new Map(),
        path: [...path],
        spellings: new Map(),
      };
      this.parents[section].set(key, parent);
    }
    const conflictKey = navConflictKey(label);
    const first = parent.firstLabels.get(conflictKey);
    if (first === undefined || lexical(label, first) < 0)
      parent.firstLabels.set(conflictKey, label);
    let spellings = parent.spellings.get(conflictKey);
    if (!spellings) {
      spellings = new Map();
      parent.spellings.set(conflictKey, spellings);
    }
    let sources = spellings.get(label);
    if (!sources) {
      sources = new Map();
      spellings.set(label, sources);
    }
    const module = entry.sourceRelativePath ?? "<unattributed>";
    const previous = sources.get(module);
    if (!previous || lexical(entry.id, previous.id) < 0)
      sources.set(module, entry);
  }

  /** Return a deterministic folder label colliding with a leaf title. */
  matchingFolder(
    section: Section,
    path: readonly string[],
    title: string,
  ): string | undefined {
    return this.parents[section]
      .get(navPathKey(path))
      ?.firstLabels.get(navConflictKey(title));
  }

  /** Report each conflicting spelling once per owning source module. */
  issues(): HierarchyIssue<T>[] {
    const issues: HierarchyIssue<T>[] = [];
    for (const section of ["pages", "components"] as const) {
      const parents = [...this.parents[section].entries()].sort(
        ([left], [right]) => lexical(left, right),
      );
      for (const [, parent] of parents) {
        const groups = [...parent.spellings.entries()].sort(([left], [right]) =>
          lexical(left, right),
        );
        for (const [, spellings] of groups) {
          if (spellings.size < 2) continue;
          const labels = [...spellings.keys()].sort(lexical);
          const message = `labels ${labels.map((label) => JSON.stringify(label)).join(" and ")} conflict ${folderLocation(section, parent.path)}`;
          for (const label of labels) {
            const sources = spellings.get(label)!;
            for (const [, entry] of [...sources].sort(([left], [right]) =>
              lexical(left, right),
            ))
              issues.push({ code: "nav-path-conflict", entry, message });
          }
        }
      }
    }
    return issues;
  }
}
