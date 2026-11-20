import type { ComponentInput, PropSchema, SchemaProps } from "@mokly/mokly";

/**
 * Keep an input's literal schema and slot names while its registration stays
 * in the entry, so its render, own props and saved variants take the types
 * that `defineComponent` derives from them. The props type is a separate
 * parameter that is never inferred, as in `defineComponent`, because deriving
 * it while the schema is still being inferred is too deep for TypeScript.
 */
export function componentInput<
  const S extends PropSchema,
  const Slots extends readonly string[] = readonly [],
  P = SchemaProps<S>,
>(input: ComponentInput<S, Slots, NoInfer<P>>): ComponentInput<S, Slots, P> {
  return input;
}

/** The title, description and related docs every registration declares. */
export function componentMetadata(title: string, description: string) {
  return {
    title,
    description,
    relatedDocs: [
      "docs/protocol/cloud/mockups.md",
      "docs/protocol/cloud/design-tokens.md",
      "docs/protocol/cloud/design-tokens-color.md",
    ],
  };
}
