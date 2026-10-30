/** Package-owned shell styling; concatenation preserves delivered bytes. */

import { NARROW_SHELL } from "./layout_breakpoint.js";

export const CSS_NAV_SEARCH = `
@media ${NARROW_SHELL} {
  .mbk-tag-picker {
    top: calc(100% + 1px);
    right: 0;
    left: 0;
    border-top: 0;
    border-radius: 0 0 12px 12px;
  }
}
`;
