/** Package-owned shell styling; concatenation preserves delivered bytes. */
export const CSS_VIEWS_LAYOUT = `
.mbk-main {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-width: 0;
  min-height: 0;
}

.mbk-screen-head {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  flex-wrap: wrap;
  flex-shrink: 0;
  gap: 12px 24px;
  padding: 14px 24px 13px;
  border-bottom: 1px solid var(--chrome-border);
  background: var(--chrome-surface);
}

.mbk-screen-head-copy {
  min-width: 0;
}

.mbk-screen-head > .mbk-seg {
  margin-left: auto;
}

.mbk-screen-head > [data-mokly-schemeswitch] {
  display: none;
  margin-left: 0;
}

.mbk-crumbs {
  margin: 0;
  color: var(--chrome-muted);
  font-size: 11.5px;
}

.mbk-crumbs .sep {
  margin: 0 6px;
  opacity: 0.55;
}

.mbk-crumb-link {
  color: inherit;
  text-decoration: none;
  border-radius: 4px;
}

.mbk-crumb-link:hover {
  color: var(--chrome-ink);
  text-decoration: underline;
}

.mbk-title-row {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 5px;
}

.mbk-title-row h2 {
  margin: 0;
  font-size: 19px;
  letter-spacing: -0.01em;
}

.mbk-idchip {
  padding: 2px 8px;
  border: 1px solid var(--chrome-border);
  border-radius: 6px;
  background: var(--chrome-bg);
  color: var(--chrome-muted);
  font-family: var(--mono);
  font-size: 11px;
  text-decoration: none;
  cursor: pointer;
}

.mbk-idchip:active {
  background: var(--chrome-border);
  border-color: var(--chrome-border-strong);
  box-shadow: inset 0 1px 2px rgba(20, 28, 22, 0.14);
  color: var(--chrome-ink);
  transform: translateY(1px);
}

.mbk-seg {
  display: inline-flex;
  padding: 3px;
  border-radius: 8px;
  background: var(--chrome-bg);
  border: 1px solid var(--chrome-border);
}

.mbk-seg span,
.mbk-seg a,
.mbk-seg button {
  padding: 4px 12px;
  border: none;
  border-radius: 6px;
  background: none;
  color: var(--chrome-muted);
  font-family: inherit;
  font-size: 12px;
  font-weight: 600;
  text-decoration: none;
  cursor: pointer;
}

.mbk-seg span.active,
.mbk-seg a.active,
.mbk-seg button.active,
.mbk-seg [aria-pressed="true"],
.mbk-seg [aria-current="page"] {
  background: var(--chrome-surface);
  color: var(--chrome-ink);
  box-shadow: 0 1px 2px rgba(20, 28, 22, 0.1);
}

.mbk-stage {
  flex: 1;
  display: flex;
  justify-content: center;
  align-items: flex-start;
  gap: 40px;
  min-height: 0;
  padding: 28px;
  overflow: auto;
  background: radial-gradient(
      circle at center,
      rgba(20, 28, 22, 0.05) 1px,
      transparent 1px
    )
    0 0 / 22px 22px;
}

.mbk-frame-wrap {
  min-width: 0;
}

.mbk-frame-mobile {
  flex: 0 0 auto;
}

.mbk-frame-desktop {
  flex: 0 1 1180px;
  min-width: 0;
}

.mbk-frame-desktop .browser-frame {
  width: 100%;
}

.mbk-frame-label {
  margin: 0 0 10px;
  color: var(--chrome-muted);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

`;
