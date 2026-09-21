/** Package-owned shell styling; concatenation preserves delivered bytes. */
export const CSS_NAV_SEARCH = `
.mbk-nav-row.active,
.mbk-nav-row[aria-current="page"] {
  color: var(--mokly-accent-contrast);
  font-weight: 600;
}

.mbk-nav-row.active::before,
.mbk-nav-row[aria-current="page"]::before {
  background: var(--mokly-accent);
}

.mbk-nav-label {
  font-weight: 600;
  color: var(--chrome-ink);
}

.mbk-nav-ico {
  display: inline-grid;
  place-items: center;
  width: 15px;
  height: 15px;
  flex-shrink: 0;
  color: var(--chrome-muted);
}

.mbk-nav-ico.flow {
  color: var(--mokly-accent);
}

.mbk-nav-ico.folder {
  color: var(--chrome-ink-2);
}

.mbk-nav-ico.folder > svg {
  grid-area: 1 / 1;
}

.mbk-nav-ico.folder > svg:nth-child(2) {
  display: none;
}

details.mbk-nav-group[open] > summary .mbk-nav-ico.folder > svg:nth-child(1) {
  display: none;
}

details.mbk-nav-group[open] > summary .mbk-nav-ico.folder > svg:nth-child(2) {
  display: block;
}

.mbk-nav-row.active .mbk-nav-ico,
.mbk-nav-row[aria-current="page"] .mbk-nav-ico {
  color: color-mix(in srgb, var(--mokly-accent-contrast) 90%, transparent);
}

.mbk-nav-row.active .mbk-nav-label,
.mbk-nav-row[aria-current="page"] .mbk-nav-label {
  color: var(--mokly-accent-contrast);
}

.mbk-nav-count {
  margin-left: auto;
  color: var(--chrome-muted);
  font-family: var(--mono);
  font-size: 10.5px;
}

.mbk-nav-row.active .mbk-nav-count,
.mbk-nav-row[aria-current="page"] .mbk-nav-count {
  color: color-mix(in srgb, var(--mokly-accent-contrast) 75%, transparent);
}

.mbk-nav-row[hidden],
details.mbk-nav-group[hidden] {
  display: none;
}

details.mbk-nav-section[hidden] {
  display: none;
}

details.mbk-nav-group > summary {
  list-style: none;
}

details.mbk-nav-group > summary::-webkit-details-marker {
  display: none;
}

@media (prefers-reduced-motion: reduce) {
  .mbk-nav-section-chevron {
    transition: none;
  }
}

.mbk-basewatch {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
  margin: 0;
  padding: 12px 24px;
  border-bottom: 1px solid var(--chrome-border);
  background: var(--chrome-surface);
  color: var(--chrome-muted);
  font-size: 12.5px;
}

.mbk-basewatch strong {
  color: var(--chrome-ink);
  font-family: var(--mono);
  font-size: 11.5px;
}

.mbk-basewatch-dot {
  width: 7px;
  height: 7px;
  border-radius: 999px;
  background: var(--mbk-status-changed-ink);
}

@media (max-width: 56.25rem) {
  .mbk-menu {
    display: inline-flex;
  }

  .mbk-topbar[data-search] .mbk-name {
    display: none;
  }

  .mbk-search {
    position: static;
  }

  .mbk-tag-picker {
    top: calc(100% + 1px);
    right: 0;
    left: 0;
    border-top: 0;
    border-radius: 0 0 12px 12px;
  }

  .mbk-nav {
    display: none;
    position: absolute;
    top: 48px;
    bottom: 0;
    left: 0;
    z-index: 10;
    width: 82%;
    max-width: 20rem;
    border-right: 1px solid var(--chrome-border);
    overflow: hidden;
    box-shadow: 0 0 0 100vmax var(--chrome-scrim);
  }

  .mbk[data-drawer="open"] .mbk-nav {
    display: flex;
  }
}

/* ---- Appearance ------------------------------------------------------- */

.mbk-appearance {
  position: relative;
  display: inline-flex;
  flex-shrink: 0;
  align-items: center;
  gap: 6px;
  height: 30px;
  padding: 0 9px;
  border: 1px solid var(--chrome-control-edge);
  border-radius: 8px;
  background: var(--chrome-surface);
  color: var(--chrome-ink-2);
  cursor: pointer;
}

.mbk-appearance[hidden] {
  display: none;
}

.mbk-appearance:hover {
  border-color: var(--mbk-accent-deep);
  background: var(--mbk-accent-surface);
  color: var(--mbk-accent-deep);
}

.mbk-appearance:focus-within {
  outline: 2px solid var(--mbk-accent-deep);
  outline-offset: 2px;
}

.mbk-appearance svg {
  display: block;
  flex-shrink: 0;
}

.mbk-appearance-value {
  font-size: 12px;
  font-weight: 600;
  white-space: nowrap;
}

.mbk-appearance > select {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  margin: 0;
  opacity: 0;
  cursor: inherit;
}

/* Below the breakpoint the label collapses to its glyph, so search and the
   menu keep their room while the control stays reachable. */
@media (max-width: 56.25rem) {
  .mbk-appearance {
    padding: 0 7px;
  }

  .mbk-appearance-value {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
  }
}
`;
