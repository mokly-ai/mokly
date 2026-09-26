/** Structured, non-fatal diagnostics retained for the CLI warning reporter. */
export interface BuildWarning {
  code:
    | "removed-dependencies"
    | "removed-owned-dependencies"
    | "removed-shared-impact"
    | "duplicate-component-stylesheet"
    | "missing-configured-stylesheet-link"
    | "ignored-declared-resource-owner";
  context: readonly string[];
  message: string;
}

const WARNING_CODES = new Set<BuildWarning["code"]>([
  "removed-dependencies",
  "removed-owned-dependencies",
  "removed-shared-impact",
  "duplicate-component-stylesheet",
  "missing-configured-stylesheet-link",
  "ignored-declared-resource-owner",
]);

export function isBuildWarning(value: unknown): value is BuildWarning {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<BuildWarning>;
  return (
    WARNING_CODES.has(candidate.code as BuildWarning["code"]) &&
    Array.isArray(candidate.context) &&
    candidate.context.length ===
      (candidate.code === "removed-dependencies" ||
      candidate.code === "removed-owned-dependencies" ||
      candidate.code === "removed-shared-impact"
        ? 1
        : 2) &&
    candidate.context.every(
      (item) => typeof item === "string" && Buffer.byteLength(item) <= 4_096,
    ) &&
    typeof candidate.message === "string" &&
    candidate.message.length > 0 &&
    Buffer.byteLength(candidate.message) <= 65_536
  );
}

export function removedDependencies(id: string): BuildWarning {
  return {
    code: "removed-dependencies",
    context: [id],
    message: `dependencies has been removed; ignoring it on entry ${JSON.stringify(id)}. Delete the field.`,
  };
}

export function removedOwnedDependencies(id: string): BuildWarning {
  return {
    code: "removed-owned-dependencies",
    context: [id],
    message: `ownedDependencies has been removed; ignoring it on component ${JSON.stringify(id)}. Delete the field.`,
  };
}

export function removedSharedImpact(configPath: string): BuildWarning {
  return {
    code: "removed-shared-impact",
    context: [configPath],
    message:
      "review.sharedImpact has been removed; ignoring it. Delete the field.",
  };
}

export function duplicateComponentStylesheet(
  id: string,
  physicalPath: string,
  publicPath: string,
): BuildWarning {
  return {
    code: "duplicate-component-stylesheet",
    context: [id, physicalPath],
    message: `duplicate component stylesheet ${JSON.stringify(publicPath)} on component ${JSON.stringify(id)} is ignored; it is linked once.`,
  };
}

export function missingConfiguredStylesheetLink(
  route: string,
  href: string,
): BuildWarning {
  return {
    code: "missing-configured-stylesheet-link",
    context: [route, href],
    message: `configured stylesheet link ${JSON.stringify(href)} is absent from ${JSON.stringify(route)}; component stylesheets use another anchor.`,
  };
}

export function ignoredDeclaredResourceOwner(
  route: string,
  physicalPath: string,
  publicPath: string,
): BuildWarning {
  return {
    code: "ignored-declared-resource-owner",
    context: [route, physicalPath],
    message: `renderer resources for declared stylesheet ${JSON.stringify(publicPath)} on ${JSON.stringify(route)} are ignored; Mokly derives owners from rendered components.`,
  };
}
