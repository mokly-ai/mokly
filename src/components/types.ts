import type { ComponentType, ReactNode } from "react";

import type {
  ColorScheme,
  Viewport,
  ComponentControl,
  ControlFor,
  InferProp,
  ObjectPropSchema,
} from "@mokly/viewer";

import type { EntryInput } from "../authoring/types.js";

export interface ComponentRenderContext {
  viewport: Viewport;
  colorScheme: ColorScheme;
}
export type ComponentProps<
  S extends ObjectPropSchema,
  Slots extends readonly string[],
> = InferProp<S> & { readonly [K in Slots[number]]?: ReactNode };

export interface ComponentVariant<P> {
  id: string;
  title: string;
  description?: string;
  props: P;
}

export interface ComponentInput<
  S extends ObjectPropSchema,
  Slots extends readonly string[],
> extends EntryInput {
  /** Opt this component and its variants out of local Live previews. */
  interactive?: false;
  propSchema: S;
  slots?: Slots;
  controls?: {
    readonly [K in keyof S["properties"]]?: ControlFor<
      S["properties"][K]["schema"]
    >;
  };
  render: (
    props: ComponentProps<NoInfer<S>, NoInfer<Slots>>,
    context: ComponentRenderContext,
  ) => ReactNode;
  variants: readonly ComponentVariant<
    ComponentProps<NoInfer<S>, NoInfer<Slots>>
  >[];
  colorSchemes?: readonly ColorScheme[];
  tags?: readonly string[];
  ownedDependencies?: readonly string[];
}

/** Runtime definition retains the adapter and slots only inside the consumer graph. */
export interface ComponentDefinition extends EntryInput {
  readonly __viaDefine: true;
  definedIn?: string;
  kind: "component";
  interactive?: false;
  navPath: readonly string[];
  propSchema: ObjectPropSchema;
  slots: readonly string[];
  controls: Readonly<Record<string, ComponentControl>>;
  render: (
    props: Readonly<Record<string, unknown>>,
    context: ComponentRenderContext,
  ) => ReactNode;
  colorSchemes?: readonly ColorScheme[];
  tags?: readonly string[];
  ownedDependencies: readonly string[];
}

/** One saved component state flattened into the catalogue beside its parent. */
export interface ComponentVariantDefinition extends EntryInput {
  readonly __viaDefine: true;
  definedIn?: string;
  kind: "component";
  interactive?: false;
  navPath: readonly string[];
  variantOf: string;
  props: Readonly<Record<string, unknown>>;
  suppliedSlots: readonly string[];
  colorSchemes?: readonly ColorScheme[];
  tags?: readonly string[];
}

/** A component parent or one of its flattened saved variants. */
export type ComponentEntryDefinition =
  ComponentDefinition | ComponentVariantDefinition;

/** Narrow one runtime component entry to its flattened variant shape. */
export function isComponentVariantDefinition(
  entry: ComponentEntryDefinition,
): entry is ComponentVariantDefinition {
  return "variantOf" in entry && typeof entry.variantOf === "string";
}

export interface RegisteredComponent<
  S extends ObjectPropSchema,
  Slots extends readonly string[],
> {
  entries: readonly [ComponentDefinition, ...ComponentVariantDefinition[]];
  Component: ComponentType<
    ComponentProps<S, Slots> & { moklyInstance?: string }
  >;
}
