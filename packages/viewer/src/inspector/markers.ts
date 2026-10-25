/**
 * The `mokly-instance` and `mokly-slot` comment markers of the comparison
 * contract. Any comment with either prefix matches; groups 2 to 4 (edge,
 * range number, attributes) are present only for a well-formed marker, and an
 * end marker carries no attributes.
 */
export const MARKER =
  /^mokly-(instance|slot):(?:(start|end) id="r-(0|[1-9]\d*)"((?: [a-z]+="[^"]*")*)$)?/;
