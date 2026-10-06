import type { ReactNode } from "react";

import type { ColorScheme } from "@mokly/viewer";

import type { ComponentEntryDefinition } from "../components/types.js";
import type { DocumentDefinition } from "../documents/types.js";

import type {
  DEFINITION,
  DEFINITION_IDENTITY,
  VARIANT_PARENT,
  VARIANT_INDEX,
  UNKNOWN_FIELDS,
} from "./markers.js";

/** Metadata shared by every authored catalogue entry. */
export interface EntryInput {
  dependencies: readonly string[];
  description: string;
  movedFrom?: string;
  path?: string;
  rationale?: string;
  relatedDocs: readonly string[];
  slug?: string;
  title: string;
}
/** One authored state flattened beneath its parent screen. */
export interface ScreenVariantInput extends Omit<
  EntryInput,
  "dependencies" | "relatedDocs" | "slug" | "path"
> {
  address?: string;
  colorSchemes?: readonly ColorScheme[];
  dependencies?: readonly string[];
  desktop: ReactNode;
  mobile: ReactNode;
  relatedDocs?: readonly string[];
  slug: string;
  tags?: readonly string[];
  useCasePaths?: readonly string[];
}
/** One screen with distinct mobile and desktop renders. */
export interface ScreenInput extends EntryInput {
  address?: string;
  colorSchemes?: readonly ColorScheme[];
  desktop: ReactNode;
  mobile: ReactNode;
  tags?: readonly string[];
  useCasePaths?: readonly string[];
  variants?: readonly ScreenVariantInput[] | undefined;
}
/** One complete HTML document rendered without device variants. */
export interface PageInput extends EntryInput {
  render: () => string;
  tags?: readonly string[];
}
/** One path-addressed screen reference in an ordered flow. */
export interface UseCaseStep {
  description?: string;
  screenPath: string;
  title?: string;
}
/** A journey composed from existing screens. */
export interface UseCaseInput extends EntryInput {
  steps: readonly UseCaseStep[];
  tags?: readonly string[];
}
/** Optional presentation of an existing folder. */
export interface FolderInput {
  path: string;
  title?: string;
  order?: readonly string[];
  hidden?: boolean;
}
/** Private facts retained across prepared copies and the consumer bundle. */
export interface DefinitionBrand {
  readonly __viaDefine: true;
  readonly [DEFINITION]: true;
  readonly [DEFINITION_IDENTITY]: { path?: string; slug?: string };
  readonly [UNKNOWN_FIELDS]?: readonly string[];
  [VARIANT_PARENT]?: EntryDefinition;
  [VARIANT_INDEX]?: number;
  definedIn?: string;
}
/** Source-attributed screen definition returned by defineScreen. */
export interface ScreenDefinition
  extends Omit<ScreenInput, "variants">, DefinitionBrand {
  kind: "screen";
  useCasePaths: readonly string[];
  variantOf?: string;
}
/** Source-attributed complete document. */
export interface PageDefinition extends PageInput, DefinitionBrand {
  kind: "page";
}
/** Source-attributed flow definition. */
export interface UseCaseDefinition extends UseCaseInput, DefinitionBrand {
  kind: "use-case";
}
/** Branded folder record collected beside entries. */
export interface FolderDefinition extends FolderInput, DefinitionBrand {
  kind: "folder";
}
/** An authored renderable entry. */
export type EntryDefinition =
  | ScreenDefinition
  | PageDefinition
  | UseCaseDefinition
  | ComponentEntryDefinition;
/** Every value collected from a module export. */
export type RegistryDefinition = EntryDefinition | FolderDefinition;
/** An entry with its fully derived identity and source location. */
export type ResolvedRegistryEntry = (EntryDefinition | DocumentDefinition) & {
  path: string;
  slug: string;
  index: boolean;
  linkBase: string;
  location: string;
  sourcePath: string;
  sourceRelativePath: string;
  /** Resolved exporting entry root, independent of the definition's authored source. */
  entryRoot?: string;
};
