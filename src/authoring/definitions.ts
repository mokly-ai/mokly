import type {
  PageDefinition,
  PageInput,
  NestedPageInput,
  NestedPageMarker,
  CollectionDefinition,
  CollectionInput,
  NestedChild,
  NestedCollectionInput,
  NestedCollectionMarker,
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
    useCaseIds: input.useCaseIds ?? [],
  });
  return variants === undefined
    ? parent
    : flattenScreenVariants(parent, variants);
}

/** Define a complete document with an explicit, stable route. */
export function definePage(input: PageInput): PageDefinition {
  return branded({ ...input, kind: "page" });
}

/** Create a page marker whose slug participates in a nested path. */
export function page(input: NestedPageInput): NestedPageMarker {
  return { ...input, __nested: "page" };
}

/** Define a structural navigation collection. */
export function defineCollection(input: CollectionInput): CollectionDefinition {
  return branded({ ...input, kind: "collection" });
}

/** Define an ordered journey that references canonical screens. */
export function defineUseCase(input: UseCaseInput): UseCaseDefinition {
  return branded({ ...input, kind: "use-case" });
}

/** Create a screen marker inside a nested tree. */
export function screen(input: NestedScreenInput): NestedScreenMarker {
  return { ...input, __nested: "screen" };
}

/** Create a collection marker inside a nested tree. */
export function collection(
  input: NestedCollectionInput,
): NestedCollectionMarker {
  return { ...input, __nested: "collection" };
}

/** Flatten a nested tree into ordinary registry definitions. */
export function defineRoot(input: RootInput): RegistryDefinition[] {
  const definitions: RegistryDefinition[] = [];
  const inherited: NestedInherited = {
    ...(input.collection?.address ? { address: input.collection.address } : {}),
    ...(input.collection?.dependencies
      ? { dependencies: input.collection.dependencies }
      : {}),
    ...(input.collection?.relatedDocs
      ? { relatedDocs: input.collection.relatedDocs }
      : {}),
  };
  if (input.collection) {
    definitions.push(
      defineCollection({
        childIds: input.children.map((child) => child.id),
        dependencies: input.collection.dependencies ?? [],
        description: input.collection.description,
        id: input.collection.id,
        ...(input.collection.rationale
          ? { rationale: input.collection.rationale }
          : {}),
        relatedDocs: input.collection.relatedDocs ?? [],
        title: input.collection.title,
      }),
    );
  }
  for (const child of input.children) {
    flattenChild(child, input.path, inherited, definitions);
  }
  return definitions;
}

function flattenChild(
  node: NestedChild,
  directory: string,
  inherited: NestedInherited,
  definitions: RegistryDefinition[],
): void {
  const effective = mergeInherited(inherited, node);
  if (node.__nested === "page") {
    const { slug, __nested: _marker, ...input } = node;
    const definition = definePage({
      ...input,
      dependencies: effective.dependencies ?? [],
      relatedDocs: effective.relatedDocs ?? [],
      route: `${directory}/${slug}.html`,
    });
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
      definitions.push(definition);
    }
    return;
  }
  const definition = defineCollection({
    childIds: node.children.map((child) => child.id),
    dependencies: effective.dependencies ?? [],
    description: node.description,
    id: node.id,
    ...(node.rationale ? { rationale: node.rationale } : {}),
    relatedDocs: effective.relatedDocs ?? [],
    title: node.title,
  });
  if (node.definedIn) definition.definedIn = node.definedIn;
  definitions.push(definition);
  for (const child of node.children) {
    flattenChild(child, `${directory}/${node.segment}`, effective, definitions);
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
