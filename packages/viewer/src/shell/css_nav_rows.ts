/** Package-owned shell styling; concatenation preserves delivered bytes. */
export const CSS_NAV_ROWS = `.mbk-body {
  display: flex;
  flex: 1;
  min-height: 0;
}

.mbk-route-status {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

.mbk-nav {
  --mbk-guide: #dbded8;
  position: relative;
  display: flex;
  flex-direction: column;
  width: var(--mbk-nav-width, 248px);
  flex-shrink: 0;
  background: #fbfbfa;
  border-right: 1px solid var(--chrome-border);
  overflow: visible;
}

.mbk-nav-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 13px 14px 9px;
  color: var(--chrome-muted);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.mbk-nav-collapse {
  padding: 0;
  border: none;
  background: none;
  color: var(--chrome-muted);
  font-family: inherit;
  font-size: 10.5px;
  font-weight: 600;
  letter-spacing: 0;
  text-transform: none;
  cursor: pointer;
}

.mbk-nav-filter {
  display: inline-flex;
  align-self: flex-start;
  margin: 0 8px 8px;
  padding: 3px;
  border-radius: 8px;
  background: var(--chrome-bg);
  border: 1px solid var(--chrome-border);
}

.mbk-nav-filter-opt {
  display: flex;
  align-items: center;
  padding: 4px 11px;
  border: none;
  border-radius: 6px;
  background: none;
  color: var(--chrome-muted);
  font-family: inherit;
  font-size: 11.5px;
  font-weight: 600;
  text-decoration: none;
  cursor: pointer;
}

.mbk-nav-filter-opt.active,
.mbk-nav-filter-opt[aria-pressed="true"] {
  background: var(--chrome-surface);
  color: var(--chrome-ink);
  box-shadow: 0 1px 2px rgba(20, 28, 22, 0.1);
}

.mbk-nav-filter-count {
  margin-left: 6px;
  border-radius: 999px;
  background: rgba(20, 28, 22, 0.08);
  color: var(--chrome-ink-2);
  font-family: var(--mono);
  font-size: 10px;
}

.mbk-nav-scroll {
  flex: 1;
  overflow-y: auto;
  padding: 4px 8px 12px;
}

.mbk-nav-section + .mbk-nav-section {
  margin-top: 10px;
}

.mbk-nav-section > summary {
  list-style: none;
}

.mbk-nav-section > summary::-webkit-details-marker {
  display: none;
}

.mbk-nav-section-head {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 6px 8px 4px;
  color: var(--chrome-muted);
  font-size: 10.5px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  cursor: pointer;
}

.mbk-nav-section-chevron {
  display: inline-grid;
  place-items: center;
  transition: transform 120ms ease;
}

.mbk-nav-section[open] > .mbk-nav-section-head .mbk-nav-section-chevron {
  transform: rotate(90deg);
}

.mbk-nav-row {
  position: relative;
  z-index: 0;
  display: flex;
  align-items: center;
  gap: 7px;
  width: 100%;
  padding: 5px 8px;
  color: var(--chrome-ink-2);
  text-decoration: none;
  font-size: 12.5px;
  line-height: 1.3;
  cursor: pointer;
}

.mbk-nav-row::before {
  content: "";
  position: absolute;
  z-index: -1;
  top: 0;
  bottom: 0;
  left: var(--mbk-indent, 0);
  right: 0;
  border-radius: 6px;
}

.mbk-nav-row:hover::before {
  background: var(--mokly-accent-soft);
}
`;
