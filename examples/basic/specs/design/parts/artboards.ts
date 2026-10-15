import type { ReactNode } from "react";

import type {
  PropSchema,
  RenderContext,
  ScreenVariantInput,
} from "@mokly/mokly";

/** The desktop and mobile artboards that depict one design state. */
export interface Artboards {
  desktop: ReactNode;
  mobile: ReactNode;
}

/** A saved design state: its variant metadata and its own artboards. */
export type ArtboardVariant = Omit<ScreenVariantInput, "props"> & Artboards;

/** The `defineScreen` render that shows the artboard of each viewport. */
export function artboards(boards: Artboards) {
  return {
    render: (_props: unknown, context: RenderContext): ReactNode =>
      boards[context.viewport],
  };
}

/**
 * The `defineScreen` fields of a design whose saved states are distinct
 * artboards. A `state` prop selects the artboards: the screen's own props
 * show `own`, and each variant's props name the variant's slug. The schema
 * lists every state, so the Props tab offers them as one select.
 */
export function artboardStates(
  own: { state: string; title: string } & Artboards,
  variants: readonly ArtboardVariant[],
) {
  const states = new Map<string, Artboards>([[own.state, own]]);
  const options = [{ const: own.state, title: own.title }];
  const saved = variants.map(({ desktop, mobile, ...variant }) => {
    states.set(variant.slug, { desktop, mobile });
    options.push({ const: variant.slug, title: variant.title });
    return { ...variant, props: { state: variant.slug } };
  });
  return {
    // The assertion keeps the broad schema type, so the props stay a record.
    propSchema: {
      type: "object",
      additionalProperties: false,
      required: ["state"],
      properties: { state: { title: "State", oneOf: options } },
    } as PropSchema,
    props: { state: own.state },
    variants: saved,
    render: (
      props: Readonly<Record<string, unknown>>,
      context: RenderContext,
    ): ReactNode => (states.get(String(props.state)) ?? own)[context.viewport],
  };
}
