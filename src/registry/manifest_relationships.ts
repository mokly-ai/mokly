import { MoklyError } from "../errors.js";

/** Validate manifest relationship targets and reciprocal memberships. */
export function validateManifestRelationships(
  entries: readonly Record<string, unknown>[],
  byPath: ReadonlyMap<string, Record<string, unknown>>,
): void {
  for (const entry of entries)
    if (
      typeof entry.variantOf === "string" &&
      entries.some(
        (child) =>
          typeof child.path === "string" &&
          child.path.startsWith(`${String(entry.path)}/`) &&
          child.variantOf !== entry.path,
      )
    )
      relationshipError(entry, "variant cannot be a folder's own page");
  for (const entry of entries) {
    if (entry.kind === "screen") validateScreen(entry, byPath);
    else if (entry.kind === "component") validateVariantParent(entry, byPath);
    else if (entry.kind === "use-case") validateUseCase(entry, byPath);
  }
  for (const entry of entries)
    if (
      entry.kind === "component" &&
      typeof entry.variantOf !== "string" &&
      !entries.some(
        (candidate) =>
          candidate.kind === "component" && candidate.variantOf === entry.path,
      )
    )
      relationshipError(entry, "component has no variants");
}

function validateScreen(
  entry: Record<string, unknown>,
  byPath: ReadonlyMap<string, Record<string, unknown>>,
): void {
  validateVariantParent(entry, byPath);
  for (const useCasePath of entry.useCasePaths as string[]) {
    const useCase = byPath.get(useCasePath);
    if (useCase?.kind !== "use-case") {
      relationshipError(
        entry,
        `use-case target is not a use case: ${useCasePath}`,
      );
    }
    const steps = useCase.steps as Array<Record<string, unknown>>;
    if (!steps.some((step) => step.screenPath === entry.path)) {
      relationshipError(
        entry,
        `use case ${useCasePath} does not reference this screen`,
      );
    }
  }
}

function validateVariantParent(
  entry: Record<string, unknown>,
  byPath: ReadonlyMap<string, Record<string, unknown>>,
): void {
  if (typeof entry.variantOf !== "string") return;
  if (String(entry.path).split("/").slice(0, -1).join("/") !== entry.variantOf)
    relationshipError(
      entry,
      "variant path must be parent path plus one segment",
    );
  const parent = byPath.get(entry.variantOf);
  if (!parent) relationshipError(entry, "variant parent does not exist");
  if (parent.kind !== entry.kind)
    relationshipError(entry, `parent is not a ${String(entry.kind)}`);
  if (typeof parent.variantOf === "string") {
    relationshipError(entry, "parent is itself a variant");
  }
}

function validateUseCase(
  entry: Record<string, unknown>,
  byPath: ReadonlyMap<string, Record<string, unknown>>,
): void {
  for (const step of entry.steps as Array<Record<string, unknown>>) {
    const screenPath = step.screenPath as string;
    const screen = byPath.get(screenPath);
    if (screen?.kind !== "screen") {
      relationshipError(entry, `step target is not a screen: ${screenPath}`);
    }
    if (!(screen.useCasePaths as string[]).includes(entry.path as string)) {
      relationshipError(
        entry,
        `screen ${screenPath} does not list this use case`,
      );
    }
  }
}

function relationshipError(
  entry: Record<string, unknown>,
  detail: string,
): never {
  throw new MoklyError(
    "manifest-invalid",
    `${String(entry.path)} has an invalid relationship: ${detail}`,
  );
}
