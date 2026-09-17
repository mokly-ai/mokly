/** Package-owned shell styling; concatenation preserves delivered bytes. */
export const CSS_VIEWS_RESPONSIVE = `.mbk-frame-scheme-note {
  display: none;
  font-weight: 500;
}

body[data-mokly-color-scheme="dark"]
  .mbk-frame-wrap[data-color-scheme-fallback]
  .mbk-frame-scheme-note {
  display: inline;
}

.mbk-live[data-viewport="mobile"] .mbk-frame-desktop {
  display: none;
}

.mbk-live[data-viewport="desktop"] .mbk-frame-mobile {
  display: none;
}

.mbk-flow {
  flex: 1;
  overflow: auto;
  padding: 28px 28px 40px;
}

.mbk-flow .flow-track {
  gap: 26px;
}

.mbk-flow .flow-step::before {
  top: 32px;
  bottom: -26px;
}

.mbk-flow .flow-step-head h3 {
  font-size: 16px;
}

.mbk-flow-screen {
  margin-left: 44px;
  max-width: 1180px;
}

.mbk-flow-screen .browser-frame {
  height: 640px;
}

.mbk-flow-screen .browser-frame.is-expanded {
  height: auto;
}

.mbk-stage-embed {
  display: flex;
  flex: 1;
  min-height: 0;
  padding: 18px 24px;
  overflow: auto;
  background: radial-gradient(
      circle at center,
      rgba(20, 28, 22, 0.05) 1px,
      transparent 1px
    )
    0 0 / 22px 22px;
}

.mbk-stage-embed iframe {
  flex: 1;
  width: 100%;
  min-height: 520px;
  border: 1px solid var(--chrome-border);
  border-radius: 12px;
  background: var(--chrome-surface);
}

.mbk-empty {
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  gap: 6px;
  padding: 40px;
  text-align: center;
  color: var(--chrome-ink-2);
}

.mbk-empty h2 {
  margin: 0;
  color: var(--chrome-ink);
  font-size: 19px;
}

.mbk-empty p {
  margin: 0;
  max-width: 460px;
  font-size: 13px;
  line-height: 1.55;
}

.mbk-empty-note {
  color: var(--chrome-muted);
  font-size: 12px;
}

.mbk-empty code {
  font-family: var(--mono);
  font-size: 11.5px;
}

.mbk-empty-link {
  margin-top: 8px;
  color: var(--mokly-accent);
  font-weight: 600;
}

.mbk-frag {
  display: block;
  width: 100%;
  height: 100%;
  border: 0;
  background: #ffffff;
}

.phone-screen .mbk-frag {
  flex: 1 1 auto;
  height: auto;
  min-height: 0;
  border-radius: 0 0 36px 36px;
}

@media (max-width: 56.25rem) {
  .mbk-topbar > [data-mokly-schemeswitch] {
    display: none;
  }

  .mbk-screen-head > [data-mokly-schemeswitch] {
    display: inline-flex;
  }
}

@media (max-width: 760px) {
  .mbk-screen-head {
    padding: 12px 16px 11px;
  }

  .mbk-screen-head > .mbk-seg {
    flex: 1 0 100%;
    margin-left: 0;
  }

  .mbk-screen-head > .mbk-seg button {
    flex: 1;
  }

  .mbk-stage {
    flex-direction: column;
    align-items: center;
  }

  .mbk-frame-desktop {
    flex: 0 0 auto;
    width: 100%;
  }

  .mbk-flow-screen {
    margin-left: 0;
  }
}
`;
