import type { FromSchema, JSONSchema } from "json-schema-to-ts";
import type { ComponentType, ReactNode } from "react";

import type { Control } from "../generated/sidecar/Control.js";

/** A schema whose runtime rules are defined by Mokly's JSON Schema profile. */
export type PropSchema = JSONSchema;
export type ColorScheme = "dark" | "light";
export type Viewport = "desktop" | "mobile";
export type RenderContext = Readonly<{
  viewport: Viewport;
  colorScheme: ColorScheme;
}>;
export type ReadonlyData<T> = T extends readonly unknown[]
  ? { readonly [K in keyof T]: ReadonlyData<T[K]> }
  : T extends object
    ? { [K in keyof T]: ReadonlyData<T[K]> }
    : T;
export type SchemaProps<S extends PropSchema> = PropSchema extends S
  ? Record<string, unknown>
  : ReadonlyData<FromSchema<S>>;

export type ComponentControl = ReadonlyData<Control>;
export type ComponentControlLabel = { label?: string; description?: string };
export type ControlFor<T> = unknown extends T
  ? ComponentControl
  : [T] extends [string]
    ? Extract<ComponentControl, { kind: "text" | "select" }>
    : [T] extends [number]
      ? Extract<ComponentControl, { kind: "number" | "select" }>
      : [T] extends [boolean]
        ? Extract<ComponentControl, { kind: "boolean" | "select" }>
        : [T] extends [string | number | boolean | null]
          ? Extract<ComponentControl, { kind: "select" }>
          : never;

export interface EntryInput {
  title: string;
  description: string;
  relatedDocs: readonly string[];
  slug?: string;
  path?: string;
  movedFrom?: string;
  rationale?: string;
  tags?: readonly string[];
}

export interface ScreenVariantInput<P = Record<string, unknown>> {
  slug: string;
  title: string;
  props: Partial<P>;
  description?: string;
  tags?: readonly string[];
  movedFrom?: string;
  colorSchemes?: readonly ColorScheme[];
  address?: string;
  rationale?: string;
  relatedDocs?: readonly string[];
  useCasePaths?: readonly EntryReference[];
}

export interface ScreenInput<P = Record<string, unknown>> extends EntryInput {
  propSchema?: PropSchema;
  props?: P;
  render: (props: P, context: RenderContext) => ReactNode;
  variants?: readonly ScreenVariantInput<P>[];
  controls?: Readonly<Record<string, ComponentControl>>;
  colorSchemes?: readonly ColorScheme[];
  address?: string;
  useCasePaths?: readonly EntryReference[];
}

export type ScreenDefinition<P = Record<string, unknown>> = ScreenInput<P> & {
  readonly kind: "screen";
  readonly sourcePath?: string;
};

export interface ComponentVariantInput<P = Record<string, unknown>> {
  slug: string;
  title: string;
  props: Partial<P>;
  description?: string;
  tags?: readonly string[];
  movedFrom?: string;
  slots?: Readonly<Record<string, ReactNode>>;
}

export type SlotProps<Names extends readonly string[]> = {
  [K in Names[number]]?: ReactNode;
};

export interface ComponentInput<
  S extends PropSchema = PropSchema,
  Names extends readonly string[] = readonly string[],
  P = SchemaProps<S>,
> extends EntryInput {
  propSchema: S;
  props?: NoInfer<P>;
  render: (
    props: NoInfer<P> & SlotProps<Names>,
    context: RenderContext,
  ) => ReactNode;
  element?: string;
  slots?: Names;
  stylesheets?: readonly string[];
  controls?: Readonly<Record<string, ComponentControl>>;
  colorSchemes?: readonly ColorScheme[];
  variants?: readonly ComponentVariantInput<NoInfer<P>>[];
}

export type ComponentDefinition<
  S extends PropSchema = PropSchema,
  Names extends readonly string[] = readonly string[],
> = ComponentInput<S, Names> & {
  readonly kind: "component";
  readonly sourcePath?: string;
  readonly Component: ComponentType<
    SchemaProps<S> & SlotProps<Names> & { moklyInstance?: string }
  >;
};

export interface PageInput extends EntryInput {
  render: () => string;
}
export type PageDefinition = PageInput & {
  readonly kind: "page";
  readonly sourcePath?: string;
};
export interface UseCaseStep {
  screenPath: EntryReference;
  title?: string;
  description?: string;
}
export interface UseCaseInput extends EntryInput {
  steps: readonly UseCaseStep[];
}
export type UseCaseDefinition = UseCaseInput & {
  readonly kind: "useCase";
  readonly sourcePath?: string;
};
export interface FolderInput {
  path: string;
  title?: string;
  order?: readonly string[];
  hidden?: boolean;
}
export type FolderDefinition = FolderInput & {
  readonly kind: "folder";
  readonly sourcePath?: string;
};

/** An imported definition is a link target without an authored path. */
export type EntryReference = string | { readonly kind: string; title: string };

export interface RenderInput extends RenderContext {
  entry: { kind: "screen" | "component"; path: string; title: string };
  node: ReactNode;
  props: Readonly<Record<string, unknown>>;
}
export interface RenderResult {
  node: ReactNode;
  resources?: readonly string[];
}
export type Renderer = (input: RenderInput) => ReactNode | RenderResult;
