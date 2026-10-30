/** Package-owned shell styling; concatenation preserves delivered bytes. */
export const CSS_NAV_RAIL = `
.mbk-fs {
  margin: 0;
  height: 100vh;
  overflow: hidden;
}

.mbk {
  position: relative;
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: var(--chrome-bg);
  color: var(--chrome-ink);
  font-family: var(--sans);
  font-size: 13px;
}

.mbk-skip-link {
  position: absolute;
  top: -100%;
  left: 12px;
  z-index: 20;
  padding: 6px 12px;
  border-radius: 8px;
  background: var(--chrome-ink);
  color: var(--_mokly-private-on-ink);
  font-weight: 600;
  text-decoration: none;
}

.mbk-skip-link:focus-visible {
  top: 8px;
}

.mbk-search-tag {
  display: inline-grid;
  place-items: center;
  width: 20px;
  height: 20px;
  flex-shrink: 0;
  margin-right: -5px;
  padding: 0;
  border: none;
  border-radius: 6px;
  background: none;
  color: var(--chrome-muted);
  cursor: pointer;
}

.mbk-search-tag:hover {
  background: var(--chrome-border);
  color: var(--chrome-ink-2);
}

.mbk-tag-picker {
  position: absolute;
  z-index: 1;
  top: calc(100% + 7px);
  right: -1px;
  left: -1px;
  padding: 9px 11px 11px;
  border: 1px solid var(--chrome-border);
  border-radius: 10px;
  background: var(--chrome-surface);
  box-shadow: var(--chrome-shadow);
}

.mbk-tag-picker-head {
  margin-bottom: 8px;
  color: var(--chrome-muted);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.mbk-tag-picker .mbk-chips {
  max-height: 210px;
  overflow-y: auto;
}

`;
