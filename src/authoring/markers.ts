/**
 * Definitions cross the consumer-bundle boundary before the CLI validates
 * them. CLI-read authoring markers must use registry symbols (`Symbol.for`)
 * or plain data, never private symbols or class identity.
 */

/** Retains forbidden fields authored on a flattened screen variant. */
export const VARIANT_AUTHORING = Symbol.for("mokly.screen-variant-authoring");

/** Retains a nested leaf's explicitly authored navigation path. */
export const NESTED_AUTHORED_NAV_PATH = Symbol.for(
  "mokly.nested-authored-nav-path",
);
