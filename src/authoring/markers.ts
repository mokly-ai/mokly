/** Cross-bundle definition brand; registry symbols survive the consumer graph. */
export const DEFINITION = Symbol.for("mokly.definition");
/** A registration object contributes its branded entries. */
export const COMPONENT_REGISTRATION = Symbol.for(
  "mokly.component-registration",
);
/** Derived variant relationship, retaining the actual parent definition. */
export const VARIANT_PARENT = Symbol.for("mokly.variant-parent");
/** Retains forbidden fields authored on a flattened screen variant. */
export const VARIANT_AUTHORING = Symbol.for("mokly.screen-variant-authoring");
/** Resolved identity shared by prepared copies, wrappers, and typed links. */
export const DEFINITION_IDENTITY = Symbol.for("mokly.definition-identity");

/** Unknown input fields retained until source-attributed registry validation. */
export const UNKNOWN_FIELDS = Symbol.for("mokly.unknown-fields");

/** Authored position retained independently of export collection order. */
export const VARIANT_INDEX = Symbol.for("mokly.variant-index");
