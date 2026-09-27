/** Package-owned shell styling; concatenation preserves delivered bytes. */
export const CSS_CHROME_EXPANSION = `
.address-copied::before {
  content: "";
  position: absolute;
  top: -4px;
  left: 50%;
  transform: translateX(-50%) rotate(45deg);
  width: 8px;
  height: 8px;
  background: var(--chrome-ink);
}

@keyframes addressCopiedIn {
  from {
    opacity: 0;
    transform: translateX(-50%) translateY(-4px);
  }

  to {
    opacity: 1;
    transform: translateX(-50%) translateY(0);
  }
}

.browser-viewport {
  height: calc(100% - 40px);
  overflow: hidden;
}

.browser-expand {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  padding: 0;
  border: 1px solid var(--chrome-border);
  border-radius: 6px;
  background: var(--chrome-surface);
  color: var(--chrome-muted);
  line-height: 1;
  cursor: pointer;
  transition:
    background 0.12s ease,
    color 0.12s ease,
    border-color 0.12s ease;
}

.browser-expand:hover {
  background: var(--chrome-surface);
  color: var(--chrome-accent);
  border-color: var(--chrome-border-strong);
}

.browser-expand .i-expand,
.browser-expand .i-collapse {
  display: inline-flex;
}

.browser-expand .i-collapse {
  display: none;
}

.browser-frame.is-expanded .browser-expand {
  color: var(--chrome-accent);
  border-color: var(--chrome-accent);
}

.browser-frame.is-expanded .browser-expand .i-expand {
  display: none;
}

.browser-frame.is-expanded .browser-expand .i-collapse {
  display: inline-flex;
}

body.frame-expanded {
  overflow: hidden;
}

body.frame-expanded::before {
  content: "";
  position: fixed;
  inset: 0;
  z-index: 900;
  background: var(--chrome-scrim);
}

.browser-frame.is-expanded {
  position: fixed;
  inset: 2.5vh 2.5vw;
  z-index: 950;
  width: auto;
  max-width: none;
  height: auto;
  box-shadow: var(--chrome-shadow);
}

.flow-track {
  display: flex;
  flex-direction: column;
  gap: 34px;
}

.flow-step {
  position: relative;
}

.flow-step::before {
  content: "";
  position: absolute;
  left: 15px;
  top: 34px;
  bottom: -34px;
  width: 2px;
  background: var(--chrome-border);
}
`;
