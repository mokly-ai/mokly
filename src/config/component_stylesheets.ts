/** Stable across separately bundled configurations and consumer render graphs. */
export const componentStylesheetsKey = "@mokly/mokly/componentStylesheets";
export const componentStylesheets: unique symbol = Symbol.for(
  componentStylesheetsKey,
);
