/** Package-owned shell styling; concatenation preserves delivered bytes. */
export const CSS_NAV_VARIANTS = `
.mbk-nav-leaf {
  display: flex;
  align-items: center;
  gap: 2px;
}

.mbk-nav-leaf[hidden] {
  display: none;
}

.mbk-nav-leaf > .mbk-nav-row {
  flex: 1;
  min-width: 0;
}

/* The row's inset pill continues under the trailing disclosure, so one
   highlight covers the whole leaf without painting a second surface. */
.mbk-nav-leaf > .mbk-nav-row::before {
  right: -18px;
}

.mbk-nav-variants-toggle {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  flex-shrink: 0;
  padding: 0;
  border: 0;
  border-radius: 4px;
  background: none;
  color: var(--chrome-muted);
  cursor: pointer;
}

.mbk-nav-variants-toggle:hover,
.mbk-nav-variants-toggle:focus-visible {
  color: var(--mbk-accent-deep);
}

.mbk-nav-variants-toggle:focus-visible {
  outline: 2px solid var(--mbk-accent-deep);
  outline-offset: 2px;
}

.mbk-nav-leaf:has(> .mbk-nav-row[aria-current="page"])
  .mbk-nav-variants-toggle {
  color: var(--mokly-accent-contrast);
}

.mbk-nav-variants-toggle svg {
  transition: transform 120ms ease;
}

.mbk-nav-variants-toggle[aria-expanded="true"] svg {
  transform: rotate(90deg);
}

.mbk-nav-variants[hidden] {
  display: none;
}

@media (prefers-reduced-motion: reduce) {
  .mbk-nav-variants-toggle svg {
    transition: none;
  }
}
`;
