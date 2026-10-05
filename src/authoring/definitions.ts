import { authoredInput } from "./fields.js";
import { registerDefinition } from "./identity.js";
import { DEFINITION, DEFINITION_IDENTITY } from "./markers.js";
import type {
  DefinitionBrand,
  FolderDefinition,
  FolderInput,
  PageDefinition,
  PageInput,
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

/** Bind a definition to its creator without changing reference identity. */
export function __attributeDefinition<T extends object>(
  value: readonly T[],
  source: string,
): readonly (T & { definedIn: string })[];
/** Bind one definition to its creator without replacing an existing attribution. */
export function __attributeDefinition<T extends object>(
  value: T,
  source: string,
): T & { definedIn: string };
export function __attributeDefinition(
  value: object | readonly object[],
  source: string,
): object | readonly object[] {
  for (const definition of Array.isArray(value) ? value : [value]) {
    if (!("definedIn" in definition))
      Object.assign(definition, { definedIn: source });
  }
  return value;
}

/** Define one screen and flatten its authored variants after it. */
export function defineScreen<T extends ScreenInput>(
  input: T & ScreenInput,
): DefineScreenResult<T>;
export function defineScreen(
  input: ScreenInput,
): ScreenDefinition | readonly ScreenDefinition[] {
  const { variants, ...parentInput } = authoredInput(input, "screen");
  const parent = branded({
    ...parentInput,
    kind: "screen" as const,
    useCasePaths: input.useCasePaths ?? [],
  });
  return variants === undefined
    ? parent
    : flattenScreenVariants(parent, variants);
}

/** Define a complete document with a file-derived path. */
export function definePage(input: PageInput): PageDefinition {
  return branded({ ...authoredInput(input, "page"), kind: "page" });
}

/** Define an ordered journey that references screens by path. */
export function defineUseCase(input: UseCaseInput): UseCaseDefinition {
  return branded({
    ...authoredInput(input, "use-case"),
    kind: "use-case",
  });
}

/** Describe the presentation of a folder created by entry paths. */
export function defineFolder(input: FolderInput): FolderDefinition {
  return branded({
    ...authoredInput(input, "folder"),
    kind: "folder",
  });
}

/** Brand a definition and allocate its per-definition resolved identity. */
export function branded<T extends object>(value: T): T & DefinitionBrand {
  const definition: T & DefinitionBrand = {
    ...value,
    __viaDefine: true,
    [DEFINITION]: true,
    [DEFINITION_IDENTITY]:
      DEFINITION_IDENTITY in value
        ? (
            value as {
              [DEFINITION_IDENTITY]: DefinitionBrand[typeof DEFINITION_IDENTITY];
            }
          )[DEFINITION_IDENTITY]
        : {},
  };
  return registerDefinition(definition);
}
