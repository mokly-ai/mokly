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

`;
