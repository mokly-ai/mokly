/** Static/Live toolbar segment, Live frame layering and the inspector notice. */
export const SHELL_LIVE_PREVIEW_CSS = `
.mbk-preview-mode {
  flex: none;
  align-items: center;
  height: 34px;
}

.mbk-preview-mode button:not([aria-pressed="true"]):not([aria-disabled="true"]):hover {
  color: var(--chrome-ink);
}

.mbk-preview-mode button:focus-visible {
  outline: 2px solid var(--mokly-accent);
  outline-offset: 1px;
}

.mbk-preview-mode button[aria-disabled="true"] {
  cursor: default;
  opacity: 0.55;
}

.mbk-live-frame {
  position: relative;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.phone-screen > .mbk-live-frame {
  flex: 1 1 auto;
}

.browser-viewport > .mbk-live-frame {
  height: 100%;
}

.mbk-component-canvas > .mbk-live-frame {
  height: 520px;
}

.mbk-live-frame > .mbk-frag {
  flex: 1 1 auto;
  min-height: 0;
}

.mbk-live-frame[data-live-frame-state="preparing"] > .mbk-frag {
  visibility: hidden;
}

.mbk-live-preparing {
  position: absolute;
  inset: 0;
  padding: 24px;
}

.phone-screen .mbk-live-preparing {
  border-radius: 0 0 36px 36px;
}

.mbk-component-canvas .mbk-live-preparing {
  border: 1px solid var(--chrome-border);
  border-radius: 8px;
}

.mbk-inspector-notice {
  margin: 0;
  color: var(--chrome-muted);
  font-size: 12px;
}
`;
