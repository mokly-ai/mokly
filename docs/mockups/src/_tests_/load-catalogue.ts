import { readdirSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

import type { ReactNode } from "react";

import type {
  ComponentDefinition,
  ComponentVariantInput,
  PageDefinition,
  RenderContext,
  ScreenDefinition,
  ScreenVariantInput,
  UseCaseDefinition,
} from "@mokly/mokly";

/**
 * A screen's or component's render as a method. TypeScript compares a
 * method's parameters in both directions, so a definition of any props type
 * fits, and a policy can still call the render.
 */
interface AnyPropsRender {
  render(
    props: Readonly<Record<string, unknown>>,
    context: RenderContext,
  ): ReactNode;
}

/**
 * The public definition that one entry module default-exports, whatever its
 * props type. A component's generated `Component` wrapper is left out,
 * because no policy renders it.
 */
export type EntryDefinition =
  | (Omit<ScreenDefinition, "render"> & AnyPropsRender)
  | (Omit<ComponentDefinition, "render" | "Component"> & AnyPropsRender)
  | PageDefinition
  | UseCaseDefinition;

/**
 * A parent or a saved variant with the path this repository's source
 * convention gives it. A parent is its module's definition, and the loader
 * never sets its `variantOf`; a rejection fixture may set it to file a parent
 * as a variant. A variant takes its parent's `kind`, names its parent's path
 * in `variantOf`, and carries only the fields that it authors; Mokly applies
 * the parent's defaults, so the catalogue index holds each variant's
 * effective metadata.
 */
export type CatalogueDefinition =
  | (EntryDefinition & { path: string; variantOf?: string })
  | (ScreenVariantInput & { kind: "screen"; path: string; variantOf: string })
  | (ComponentVariantInput & {
      kind: "component";
      path: string;
      variantOf: string;
    });

/** One definition and its exporting module, relative to `entries/`. */
export interface LoadedDefinition {
  definition: CatalogueDefinition;
  module: string;
  /** Preserve a declared path before the loader supplies a derived path. */
  authoredPath?: string;
}

const entryKinds = new Set<unknown>(["screen", "component", "page", "useCase"]);

/** Whether a module's default export is a screen, component, page or use case. */
function isEntryDefinition(value: unknown): value is EntryDefinition {
  return (
    typeof value === "object" &&
    value !== null &&
    "kind" in value &&
    entryKinds.has(value.kind)
  );
}

/** The directory-owner rule used by the source policy, independently of output. */
export function modulePath(module: string): string {
  return module.replace(/\.mockup\.(?:ts|tsx)$/, "").replace(/\/index$/, "");
}

/** A parent's saved variants, each at the parent's path plus its slug. */
function variantDefinitions(
  parent: EntryDefinition,
  path: string,
): CatalogueDefinition[] {
  const at = (slug: string) => ({ path: path + "/" + slug, variantOf: path });
  if (parent.kind === "screen")
    return (parent.variants ?? []).map((variant) => ({
      ...variant,
      kind: "screen",
      ...at(variant.slug),
    }));
  if (parent.kind === "component")
    return (parent.variants ?? []).map((variant) => ({
      ...variant,
      kind: "component",
      ...at(variant.slug),
    }));
  return [];
}

/**
 * Each entry module default-exports one definition. Resolve the parent and
 * its saved variants as one flat list for the source policies. The public
 * CLI validates full authoring semantics and writes the catalogue index
 * separately.
 */
export async function loadDefinitions(): Promise<LoadedDefinition[]> {
  const directory = resolve(import.meta.dirname, "../entries");
  const files = readdirSync(directory, { recursive: true, encoding: "utf8" })
    .filter((file) => /\.mockup\.(?:ts|tsx)$/.test(file))
    .sort();
  const loaded: LoadedDefinition[] = [];
  for (const file of files) {
    const module: { default?: unknown } = await import(
      pathToFileURL(resolve(directory, file)).href
    );
    const parent = module.default;
    if (!isEntryDefinition(parent))
      throw new Error(`${file} must default-export one entry definition`);
    const path = parent.path ?? modulePath(file);
    loaded.push({
      definition: { ...parent, path },
      module: file,
      authoredPath: parent.path,
    });
    for (const definition of variantDefinitions(parent, path))
      loaded.push({ definition, module: file });
  }
  return loaded;
}

/** Every authored definition the source policies inspect. */
export async function loadCatalogue(): Promise<CatalogueDefinition[]> {
  return (await loadDefinitions()).map(({ definition }) => definition);
}
