/** Declarative component data shared by the read model, the detail and controls. */

import type {
  BooleanTag,
  ComponentWireValue,
  NullTag,
  NumberTag,
  StringTag,
} from "@mokly/model";

export type { ComponentWireValue, PropSchema } from "@mokly/model";

export type PropPrimitive = string | number | boolean | null;
export type PropValue =
  PropPrimitive | readonly PropValue[] | { readonly [key: string]: PropValue };
export type ComponentPropsData = Readonly<Record<string, PropValue>>;

/** The tagged form of one primitive prop value. */
export type ComponentWirePrimitive =
  [NullTag] | [BooleanTag, boolean] | [NumberTag, string] | [StringTag, string];
/** Tagged props keyed by prop name, as the read model carries them. */
export type ComponentWireProps = { [key in string]: ComponentWireValue };
