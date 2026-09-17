import type { ComponentType, ReactNode } from "react";

import type {
  ColorScheme,
  Viewport,
  ComponentControl,
  ControlFor,
  InferProp,
  ObjectPropSchema,
} from "@mokly/viewer";

import type { RoutedEntryInput } from "../authoring/types.js";

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
> extends RoutedEntryInput {
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
export interface ComponentDefinition extends RoutedEntryInput {
  readonly __viaDefine: true;
  definedIn?: string;
  kind: "component";
  propSchema: ObjectPropSchema;
  slots: readonly string[];
  controls: Readonly<Record<string, ComponentControl>>;
  render: (
    props: Readonly<Record<string, unknown>>,
    context: ComponentRenderContext,
  ) => ReactNode;
  variants: readonly ComponentVariant<Readonly<Record<string, unknown>>>[];
  colorSchemes?: readonly ColorScheme[];
  tags?: readonly string[];
  ownedDependencies: readonly string[];
}

export interface RegisteredComponent<
  S extends ObjectPropSchema,
  Slots extends readonly string[],
> {
  entry: ComponentDefinition;
  Component: ComponentType<
    ComponentProps<S, Slots> & { moklyInstance?: string }
  >;
}
