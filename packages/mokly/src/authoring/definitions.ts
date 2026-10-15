import type { ReactNode } from "react";

import { componentWrapper } from "./components.js";
import { linkHelpers } from "./links.js";
import { markerHelpers } from "./markers.js";
import { brand, defaultRuntime, definitions } from "./runtime.js";
import type { AuthoringRuntime, DefinitionData } from "./runtime.js";
import type {
  ComponentDefinition,
  ComponentInput,
  FolderDefinition,
  FolderInput,
  PageDefinition,
  PageInput,
  PropSchema,
  SchemaProps,
  ScreenDefinition,
  ScreenInput,
  ScreenVariantInput,
  UseCaseDefinition,
  UseCaseInput,
} from "./types.js";

export function defineScreen<
  P extends Record<string, unknown> = Record<string, never>,
>(
  input: Omit<ScreenInput<P>, "variants"> & {
    propSchema?: never;
    variants?: readonly ScreenVariantInput<NoInfer<P>>[];
  },
): ScreenDefinition<P>;
export function defineScreen<const S extends PropSchema, P = SchemaProps<S>>(
  input: ScreenInput<NoInfer<P>> & { propSchema: S },
): ScreenDefinition<SchemaProps<S>>;
export function defineScreen(input: object): unknown {
  return makeDefinition("screen", input, defaultRuntime);
}

export function defineComponent<
  const S extends PropSchema,
  const Names extends readonly string[] = readonly [],
  P = SchemaProps<S>,
>(input: ComponentInput<S, Names, NoInfer<P>>): ComponentDefinition<S, Names> {
  return makeDefinition(
    "component",
    input,
    defaultRuntime,
  ) as ComponentDefinition<S, Names>;
}

export function definePage(input: PageInput): PageDefinition {
  return makeDefinition("page", input, defaultRuntime) as PageDefinition;
}
export function defineUseCase(input: UseCaseInput): UseCaseDefinition {
  return makeDefinition("useCase", input, defaultRuntime) as UseCaseDefinition;
}
export function defineFolder(input: FolderInput): FolderDefinition {
  return makeDefinition("folder", input, defaultRuntime) as FolderDefinition;
}

function makeDefinition(
  kind: string,
  input: object,
  runtime: AuthoringRuntime,
  source?: string,
): object {
  const data: DefinitionData = {
    kind,
    input: input as Record<string, unknown>,
    runtime,
  };
  if (source !== undefined) data.source = source;
  const definition = {
    ...input,
    kind,
    [brand]: true,
    ...(source !== undefined ? { sourcePath: source } : {}),
  };
  definitions.set(definition, data);
  if (kind === "component") {
    let Component: ((props: Record<string, unknown>) => ReactNode) | undefined;
    Object.defineProperty(definition, "Component", {
      enumerable: true,
      get: () => (Component ??= componentWrapper(definition, data)),
    });
  }
  return Object.freeze(definition);
}

/** Bind helpers to the importing source module and the generation's runtime. */
export function createAuthoring(runtime: AuthoringRuntime, source?: string) {
  return {
    defineScreen: ((input: object) =>
      makeDefinition("screen", input, runtime, source)) as typeof defineScreen,
    defineComponent: ((input: object) =>
      makeDefinition(
        "component",
        input,
        runtime,
        source,
      )) as typeof defineComponent,
    definePage: ((input: object) =>
      makeDefinition("page", input, runtime, source)) as typeof definePage,
    defineUseCase: ((input: object) =>
      makeDefinition(
        "useCase",
        input,
        runtime,
        source,
      )) as typeof defineUseCase,
    defineFolder: ((input: object) =>
      makeDefinition("folder", input, runtime, source)) as typeof defineFolder,
    ...linkHelpers(runtime, source),
    ...markerHelpers(runtime),
  };
}
