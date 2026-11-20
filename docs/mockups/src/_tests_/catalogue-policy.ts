import { isEntryPath } from "@mokly/viewer/data";

import {
  componentVariantLimit,
  screenVariantLimit,
  variantParent,
} from "./catalogue-variants";
import { definitionViolations } from "./definition-policy";
import { modulePath } from "./load-catalogue";
import type { CatalogueDefinition, LoadedDefinition } from "./load-catalogue";

/** The folders at the top of the Pages and Components sections. */
export const catalogueRoots = {
  pages: ["design", "flows", "product"],
  components: ["design"],
} as const;

/** Consumer constraints beyond the package's own schema and byte-drift checks. */
export function catalogueViolations(
  entries: readonly CatalogueDefinition[],
): string[] {
  const problems: string[] = [];
  const ids = new Map(
    entries.map((entry) => [entry.path.toLowerCase(), entry]),
  );
  if (ids.size !== entries.length) problems.push("duplicate entry path");
  const variants = new Map<string, string[]>();
  for (const entry of entries) {
    const parentId = variantParent(entry);
    if (parentId === undefined) continue;
    variants.set(parentId, [...(variants.get(parentId) ?? []), entry.path]);
    const parent = ids.get(parentId.toLowerCase());
    if (
      parent?.kind !== entry.kind ||
      variantParent(parent) !== undefined ||
      entry.path !== parent.path + "/" + entry.slug
    )
      problems.push(
        "variant needs a parent of its kind and path: " + entry.path,
      );
  }
  for (const entry of entries) {
    const roots: readonly string[] =
      entry.kind === "component"
        ? catalogueRoots.components
        : catalogueRoots.pages;
    if (!roots.includes(entry.path.split("/")[0] ?? ""))
      problems.push("folder outside the catalogue roots: " + entry.path);
    if (!isEntryPath(entry.path))
      problems.push("invalid entry path: " + entry.path);
    const owned = variants.get(entry.path) ?? [];
    if (entry.kind === "screen" && owned.length > screenVariantLimit)
      problems.push("at most four variants per screen: " + entry.path);
    if (
      entry.kind === "component" &&
      variantParent(entry) === undefined &&
      (owned.length < 1 || owned.length > componentVariantLimit)
    )
      problems.push("one to five saved variants: " + entry.path);
    if (
      (entry.kind === "screen" || entry.kind === "component") &&
      "colorSchemes" in entry &&
      entry.colorSchemes &&
      (entry.colorSchemes.length !== 2 ||
        !entry.colorSchemes.includes("light") ||
        !entry.colorSchemes.includes("dark"))
    )
      problems.push("both themes required: " + entry.path);
    if (entry.kind === "screen")
      for (const reference of entry.useCasePaths ?? []) {
        if (typeof reference !== "string") {
          problems.push("flow references use screen paths: " + entry.path);
          continue;
        }
        const flow = ids.get(reference.toLowerCase());
        if (
          flow?.kind !== "useCase" ||
          !flow.steps.some((step) => step.screenPath === entry.path)
        )
          problems.push("invalid reciprocal flow: " + entry.path);
      }
    if (entry.kind === "useCase") {
      if (entry.steps.length < 2)
        problems.push("flow needs a sequence: " + entry.path);
      for (const { screenPath } of entry.steps) {
        if (typeof screenPath !== "string") {
          problems.push("flow references use screen paths: " + entry.path);
          continue;
        }
        const screen = ids.get(screenPath.toLowerCase());
        if (
          screen?.kind !== "screen" ||
          !(screen.useCasePaths ?? []).includes(entry.path)
        )
          problems.push("flow requires a reciprocal screen: " + entry.path);
      }
    }
  }
  return [...problems, ...definitionViolations(entries)];
}

/** Source directories and authored fields obey rules independent of path derivation. */
export function sourceTreeViolations(
  loaded: readonly LoadedDefinition[],
): string[] {
  const problems: string[] = [];
  const modules = new Set(loaded.map(({ module }) => module));
  for (const module of modules) {
    const segments = module.split("/");
    const file = segments.pop() ?? "";
    const directory = segments.join("/");
    const slug = file.split(".")[0];
    if (slug !== "index" && slug === segments.at(-1))
      problems.push("directory owner uses index: " + module);
    if (
      slug === "index" &&
      ![...modules].some(
        (sibling) =>
          sibling !== module &&
          sibling.split("/").slice(0, -1).join("/") === directory,
      )
    )
      problems.push("index requires a sibling module: " + module);
  }
  for (const { definition, module, authoredPath } of loaded) {
    if (authoredPath !== undefined)
      problems.push("authored path is forbidden: " + module);
    const parent = variantParent(definition);
    const expected = modulePath(module);
    const path = parent ? expected + "/" + definition.slug : expected;
    if (definition.path !== path || (parent && parent !== expected))
      problems.push("module derives its entry path: " + module);
    if (
      definition.path === "product/account/callback" &&
      definition.title !== "Sign-in link · Pending"
    )
      problems.push("callback owner keeps its pending title: " + module);
  }
  return problems;
}
