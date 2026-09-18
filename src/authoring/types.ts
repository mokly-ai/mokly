import type { ReactNode } from "react";

import type { ColorScheme } from "@mokly/viewer";

import type { ComponentDefinition } from "../components/types.js";

/** Metadata shared by all structured catalogue entries. */
export interface EntryInput {
  dependencies: readonly string[];
  description: string;
  id: string;
  rationale?: string;
  relatedDocs: readonly string[];
  title: string;
}

/** Metadata shared by entries that own a route. */
export interface RoutedEntryInput extends EntryInput {
  route: string;
}

/** One screen with distinct mobile and desktop renders. */
export interface ScreenInput extends RoutedEntryInput {
  address?: string;
  colorSchemes?: readonly ColorScheme[];
  desktop: ReactNode;
  mobile: ReactNode;
  /** Lowercase kebab-case classification tags, e.g. ["forms"]. */
  tags?: readonly string[];
  useCaseIds?: readonly string[];
}

/** One complete HTML document rendered without device variants. */
export interface PageInput extends RoutedEntryInput {
  render: () => string;
  tags?: readonly string[];
}

/** A structural navigation collection. */
export interface CollectionInput extends EntryInput {
  childIds: readonly string[];
}

/** One canonical screen reference in an ordered use case. */
export interface UseCaseStep {
  description?: string;
  screenId: string;
  title?: string;
}

/** A journey composed from existing screens. */
export interface UseCaseInput extends RoutedEntryInput {
  steps: readonly UseCaseStep[];
  /** Lowercase kebab-case classification tags, e.g. ["forms"]. */
  tags?: readonly string[];
}

interface DefinitionBrand {
  readonly __viaDefine: true;
  definedIn?: string;
}

/** Validated screen definition created by `defineScreen`. */
export interface ScreenDefinition extends ScreenInput, DefinitionBrand {
  kind: "screen";
  useCaseIds: readonly string[];
}

/** Source-attributed whole-document definition. */
export interface PageDefinition extends PageInput, DefinitionBrand {
  kind: "page";
}

/** Validated collection definition created by `defineCollection`. */
export interface CollectionDefinition extends CollectionInput, DefinitionBrand {
  kind: "collection";
}

/** Validated use-case definition created by `defineUseCase`. */
export interface UseCaseDefinition extends UseCaseInput, DefinitionBrand {
  kind: "use-case";
}

/** Any structured catalogue definition. */
export type RegistryDefinition =
  | ScreenDefinition
  | PageDefinition
  | CollectionDefinition
  | UseCaseDefinition
  | ComponentDefinition;

/** Fields inherited by a nested child from its ancestors. */
export interface NestedInherited {
  address?: string;
  dependencies?: readonly string[];
  relatedDocs?: readonly string[];
}

/** A screen in a nested definition tree. */
export interface NestedScreenInput extends NestedInherited {
  colorSchemes?: readonly ColorScheme[];
  description: string;
  desktop: ReactNode;
  id: string;
  mobile: ReactNode;
  rationale?: string;
  slug: string;
  /** Lowercase kebab-case classification tags; never inherited from ancestors. */
  tags?: readonly string[];
  title: string;
  useCaseIds?: readonly string[];
}

/** Whole document with a route derived from ancestor paths and this slug. */
export interface NestedPageInput extends Omit<
  PageInput,
  "route" | "dependencies" | "relatedDocs"
> {
  dependencies?: readonly string[];
  relatedDocs?: readonly string[];
  slug: string;
}

/** Source-attributed marker for nested page composition. */
export interface NestedPageMarker extends NestedPageInput {
  __nested: "page";
  definedIn?: string;
}

/** A collection in a nested definition tree. */
export interface NestedCollectionInput extends NestedInherited {
  children: readonly NestedChild[];
  description: string;
  id: string;
  rationale?: string;
  segment: string;
  title: string;
}

/** Root collection metadata for a nested definition tree. */
export interface RootCollectionInput extends NestedInherited {
  description: string;
  id: string;
  rationale?: string;
  title: string;
}

/** Root position and children for a nested definition tree. */
export interface RootInput {
  children: readonly NestedChild[];
  collection?: RootCollectionInput;
  path: string;
}

/** Marker returned by `screen` for nested composition. */
export interface NestedScreenMarker extends NestedScreenInput {
  __nested: "screen";
  definedIn?: string;
}

/** Marker returned by `collection` for nested composition. */
export interface NestedCollectionMarker extends NestedCollectionInput {
  __nested: "collection";
  definedIn?: string;
}

/** A nested screen, page, or collection. */
export type NestedChild =
  NestedScreenMarker | NestedPageMarker | NestedCollectionMarker;

/** A definition annotated with its authored source module. */
export type ResolvedRegistryEntry = RegistryDefinition & {
  sourcePath: string;
  sourceRelativePath: string;
};
