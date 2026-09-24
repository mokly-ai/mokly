import { MoklyError } from "../errors.js";

import { NESTED_AUTHORED_NAV_PATH } from "./markers.js";
import type {
  PageDefinition,
  PageInput,
  NestedPageInput,
  NestedPageMarker,
  NestedChild,
  NestedFolderInput,
  NestedFolderMarker,
  NestedInherited,
  NestedScreenInput,
  NestedScreenMarker,
  RegistryDefinition,
  RootInput,
  ScreenDefinition,
  ScreenInput,
  ScreenVariantInput,
  UseCaseDefinition,
  UseCaseInput,
} from "./types.js";
import { flattenScreenVariants } from "./variants.js";

/** Whether a nested leaf explicitly authored a path before flattening. */
export function nestedAuthoredNavPath(definition: object): boolean {
  return NESTED_AUTHORED_NAV_PATH in definition;
}

type DefineScreenVariantsResult<T> = [T] extends [never]
  ? ScreenDefinition
  : T extends readonly ScreenVariantInput[]
    ? readonly ScreenDefinition[]
    : ScreenDefinition;

type DefineScreenResult<T extends ScreenInput> = T extends unknown
  ? DefineScreenVariantsResult<
      "variants" extends keyof T ? T["variants" & keyof T] : undefined
    >
  : never;

/** Loader hook used by module-bound consumer authoring facades. */
export function __attributeDefinition<T extends object>(
  value: readonly T[],
  sourceRelativePath: string,
): readonly (T & { definedIn: string })[];
/** Loader hook used by module-bound consumer authoring facades. */
export function __attributeDefinition<T extends object>(
  value: T,
  sourceRelativePath: string,
): T & { definedIn: string };
export function __attributeDefinition(
  value: object | readonly object[],
  sourceRelativePath: string,
): object | readonly object[] {
  if (Array.isArray(value)) {
    return value.map((definition) => ({
      ...definition,
      definedIn: sourceRelativePath,
    }));
  }
  return { ...value, definedIn: sourceRelativePath };
}

/** Define one canonical screen and flatten any declared variants after it. */
export function defineScreen<const T extends ScreenInput>(
  input: T,
): DefineScreenResult<T>;
export function defineScreen(
  input: ScreenInput,
): ScreenDefinition | readonly ScreenDefinition[] {
  const { variants, ...parentInput } = input;
  const parent = branded({
    ...parentInput,
    kind: "screen" as const,
    navPath: input.navPath === undefined ? [] : input.navPath,
    useCaseIds: input.useCaseIds ?? [],
  });
  return variants === undefined
    ? parent
    : flattenScreenVariants(parent, variants);
}

/** Define a complete document with an explicit, stable route. */
export function definePage(input: PageInput): PageDefinition {
  return branded({
    ...input,
    kind: "page",
    navPath: input.navPath === undefined ? [] : input.navPath,
  });
}

/** Create a page marker whose slug participates in a nested path. */
export function page(input: NestedPageInput): NestedPageMarker {
  return { ...input, __nested: "page" };
}

/** Define an ordered journey that references canonical screens. */
export function defineUseCase(input: UseCaseInput): UseCaseDefinition {
  return branded({
    ...input,
    kind: "use-case",
    navPath: input.navPath === undefined ? [] : input.navPath,
  });
}

/** Create a screen marker inside a nested tree. */
export function screen(input: NestedScreenInput): NestedScreenMarker {
  return { ...input, __nested: "screen" };
}

/** Create a folder marker inside a nested tree. */
export function folder(input: NestedFolderInput): NestedFolderMarker {
  return { ...input, __nested: "folder" };
}

/** Flatten a nested tree into ordinary registry definitions. */
export function defineRoot(input: RootInput): RegistryDefinition[] {
  const definitions: RegistryDefinition[] = [];
  if (input.navPath !== undefined && !Array.isArray(input.navPath)) {
    throw new MoklyError(
      "build-invalid",
      `root ${input.path} navPath must be an array`,
    );
  }
  if (input.navPath?.length && input.children.length === 0) {
    throw new MoklyError("build-invalid", `root ${input.path} has no children`);
  }
  const inherited: NestedInherited = input;
  const navPath = input.navPath ?? [];
  for (const child of input.children) {
    flattenChild(child, input.path, inherited, navPath, definitions);
  }
  return definitions;
}

function flattenChild(
  node: NestedChild,
  directory: string,
  inherited: NestedInherited,
  navPath: readonly string[],
  definitions: RegistryDefinition[],
): void {
  const effective = mergeInherited(inherited, node);
  if (node.__nested === "page") {
    const { slug, __nested: _marker, ...input } = node;
    const definition = definePage({
      ...input,
      dependencies: effective.dependencies ?? [],
      navPath,
      relatedDocs: effective.relatedDocs ?? [],
      route: `${directory}/${slug}.html`,
    });
    if (Object.hasOwn(node, "navPath")) {
      Object.assign(definition, { [NESTED_AUTHORED_NAV_PATH]: true });
    }
    if (node.definedIn) definition.definedIn = node.definedIn;
    definitions.push(definition);
    return;
  }
  if (node.__nested === "screen") {
    const flattened = defineScreen({
      ...(effective.address ? { address: effective.address } : {}),
      ...(node.colorSchemes ? { colorSchemes: node.colorSchemes } : {}),
      dependencies: effective.dependencies ?? [],
      description: node.description,
      desktop: node.desktop,
      id: node.id,
      mobile: node.mobile,
      navPath,
      ...(node.rationale ? { rationale: node.rationale } : {}),
      relatedDocs: effective.relatedDocs ?? [],
      route: `${directory}/${node.slug}.html`,
      ...(node.tags ? { tags: node.tags } : {}),
      title: node.title,
      useCaseIds: node.useCaseIds ?? [],
      ...(node.variants ? { variants: node.variants } : {}),
    });
    const screenDefinitions = Array.isArray(flattened)
      ? flattened
      : [flattened];
    for (const definition of screenDefinitions) {
      if (node.definedIn) definition.definedIn = node.definedIn;
      if (
        Object.hasOwn(node, "navPath") &&
        definition.variantOf === undefined
      ) {
        Object.assign(definition, { [NESTED_AUTHORED_NAV_PATH]: true });
      }
      definitions.push(definition);
    }
    return;
  }
  if (typeof node.segment !== "string" || node.segment.length === 0) {
    throw new MoklyError(
      "build-invalid",
      `folder ${directory} segment must be a non-empty string`,
    );
  }
  const folderDirectory = `${directory}/${node.segment}`;
  if (node.children.length === 0) {
    throw new MoklyError(
      "build-invalid",
      `folder ${folderDirectory} has no children`,
    );
  }
  for (const child of node.children) {
    flattenChild(
      child,
      folderDirectory,
      effective,
      [...navPath, node.title],
      definitions,
    );
  }
}

function mergeInherited(
  parent: NestedInherited,
  child: NestedInherited,
): NestedInherited {
  return {
    ...((child.address ?? parent.address)
      ? { address: child.address ?? parent.address }
      : {}),
    ...((child.dependencies ?? parent.dependencies)
      ? { dependencies: child.dependencies ?? parent.dependencies }
      : {}),
    ...((child.relatedDocs ?? parent.relatedDocs)
      ? { relatedDocs: child.relatedDocs ?? parent.relatedDocs }
      : {}),
  };
}

function branded<T extends object>(
  value: T,
): T & { __viaDefine: true; definedIn?: string } {
  return { ...value, __viaDefine: true };
}
