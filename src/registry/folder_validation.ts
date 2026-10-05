import type { ResolvedRegistryEntry } from "../authoring/types.js";

import type { FolderRecord } from "./folder_records.js";
import type { RegistryViolation } from "./prepared_types.js";

/** Validate merged folder carriers against the actual path tree. */
export function folderViolations(
  records: readonly FolderRecord[],
  entries: readonly ResolvedRegistryEntry[],
): RegistryViolation[] {
  const errors: RegistryViolation[] = [];
  const groups = new Map<string, FolderRecord[]>();
  const add = (code: string, message: string): void => {
    errors.push({ code, message, sourceRelativePath: "" });
  };
  for (const record of records)
    groups.set(record.path.toLowerCase(), [
      ...(groups.get(record.path.toLowerCase()) ?? []),
      record,
    ]);
  for (const group of groups.values())
    if (group.length > 1)
      add(
        "duplicate-folder",
        `folder ${group[0]!.path} is defined twice:\n${group
          .map((record) => record.location)
          .sort()
          .map((location) => `  ${location}`)
          .join("\n")}`,
      );
  for (const record of records) {
    const index = entries.find((entry) => entry.path === record.path);
    if (
      record.title !== undefined &&
      (index?.kind === "screen" || index?.kind === "component")
    )
      add(
        "invalid-folder",
        `${record.location}: title cannot be set for a folder whose own page is a screen or component; set the entry's title`,
      );
    const prefix = record.path ? `${record.path}/` : "";
    const descendants = entries.filter(
      (entry) => entry.path.startsWith(prefix) && entry.path !== record.path,
    );
    if (!descendants.length && record.path)
      add(
        "unused-folder",
        `${record.location} describes folder ${record.path}, but no entry is below it`,
      );
    const children = new Set(
      descendants
        .filter(
          (entry) => !("variantOf" in entry && entry.variantOf === record.path),
        )
        .map((entry) => entry.path.slice(prefix.length).split("/")[0]),
    );
    for (const slug of record.order ?? [])
      if (slug !== "..." && !children.has(slug))
        add(
          "unknown-folder-child",
          `${record.location}: order names ${slug}, which is not a child of ${record.path}`,
        );
  }
  return errors;
}
