/** Package-owned shell styling; concatenation preserves delivered bytes. */
export const CSS_NAV_CHANGED = `
/* The changed mark: a 6px accent dot at the row's trailing edge and the
   wording a screen reader hears beside it. Both are driven by the row's own
   attributes, so a client evidence refresh moves the mark by toggling them.
   A Removed row is never marked; its label already names its state. */
.mbk-nav-changed-text {
  display: none;
}

a[data-nav-row][data-changed="true"]:not([data-nav-removed])::after,
a[data-nav-row][data-changed-variants="true"]::after {
  content: "";
  width: 6px;
  height: 6px;
  flex-shrink: 0;
  margin-left: auto;
  border-radius: 50%;
  background: var(--mokly-accent);
}

a[data-nav-row][aria-current="page"][data-changed="true"]::after,
a[data-nav-row][aria-current="page"][data-changed-variants="true"]::after {
  background: var(--mokly-accent-contrast);
}

a[data-nav-row][data-changed="true"]:not([data-nav-removed])
  .mbk-nav-changed-text,
a[data-nav-row][data-changed-variants="true"] .mbk-nav-changed-text {
  display: block;
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
}
`;
