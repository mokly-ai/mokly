/** Declarative component data shared by the read model, the detail and controls. */

import type { BooleanTag } from "../generated/catalogue/BooleanTag.js";
import type { ComponentWireValue } from "../generated/catalogue/ComponentWireValue.js";
import type { NullTag } from "../generated/catalogue/NullTag.js";
import type { NumberTag } from "../generated/catalogue/NumberTag.js";
import type { StringTag } from "../generated/catalogue/StringTag.js";

export type { ComponentWireValue } from "../generated/catalogue/ComponentWireValue.js";
export type { PropSchema } from "../generated/catalogue/PropSchema.js";

export type PropPrimitive = string | number | boolean | null;
export type PropValue =
  PropPrimitive | readonly PropValue[] | { readonly [key: string]: PropValue };
export type ComponentPropsData = Readonly<Record<string, PropValue>>;

/** The tagged form of one primitive prop value. */
export type ComponentWirePrimitive =
  [NullTag] | [BooleanTag, boolean] | [NumberTag, string] | [StringTag, string];
/** Tagged props keyed by prop name, as the read model carries them. */
export type ComponentWireProps = { [key in string]: ComponentWireValue };
