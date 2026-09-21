/** Design tokens, font, and base element styles for the served shell. */

/**
 * The Light half of the one semantic palette, recorded in
 * `docs/protocol/mokly-viewer-palette.md`. Every themed role is declared here
 * and redeclared in `css_theme.ts`, so a role can never exist in one
 * appearance only. Values carry the contract's three Light corrections:
 * `--chrome-muted` is `#676e6a`, control boundaries use the new
 * `--chrome-control-edge`, and an invalid field borders `--mbk-danger-ink`.
 */
export const SHELL_TOKENS_CSS = `
@font-face {
  font-family: "Inter";
  font-style: normal;
  font-weight: 100 900;
  font-display: swap;
  src: url("/__mokly/fonts/InterVariable.woff2") format("woff2");
}

:root {
  color-scheme: light;
  --chrome-bg: #f4f4f1;
  --chrome-surface: #ffffff;
  --chrome-raised: #fbfbfa;
  --chrome-hover: #f4f6f3;
  --chrome-ink: #1a1d1c;
  --chrome-ink-2: #4a4f4d;
  --chrome-muted: #676e6a;
  --chrome-border: #e3e5e0;
  --chrome-border-strong: #c8ccc4;
  --chrome-control-edge: #868e88;
  --chrome-accent: #2a4733;
  --chrome-count-bg: rgba(20, 28, 22, 0.08);
  --chrome-scrim: rgba(20, 28, 22, 0.45);
  --chrome-disabled-bg: #e6ebe7;
  --chrome-disabled-edge: #d7dfd9;
  --chrome-disabled-ink: #5d6f63;
  --chrome-shadow: 0 30px 90px rgba(20, 28, 22, 0.14);
  --chrome-shadow-soft: 0 1px 2px rgba(20, 28, 22, 0.1);
  --chrome-shadow-press: inset 0 1px 2px rgba(20, 28, 22, 0.14);
  --chrome-shadow-drawer: 0 18px 50px rgba(20, 28, 22, 0.3);
  --chrome-shadow-sheet: 0 6px 28px rgba(36, 55, 43, 0.15);
  --sans: "Inter", ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont,
    "Segoe UI", sans-serif;
  --mono: "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace;
  --mokly-accent-default: #4f7864;
  --mokly-accent-contrast-default: #ffffff;
  --mokly-accent-soft-default: rgba(79, 120, 100, 0.1);
  --mokly-accent: var(--mokly-accent-default);
  --mokly-accent-contrast: var(--mokly-accent-contrast-default);
  --mokly-accent-soft: var(--mokly-accent-soft-default);
  --mbk-accent-deep: #2f5945;
  --mbk-accent-surface: #edf3ef;
  --mbk-accent-edge: #b9cfc2;
  --mbk-guide: #dbded8;
  --mbk-dot: rgba(20, 28, 22, 0.05);
  --mbk-browser-bar: #ecede9;
  --mbk-status-changed-bg: #fff7e6;
  --mbk-status-changed-edge: #ead6ac;
  --mbk-status-changed-ink: #805d1d;
  --mbk-status-removed-bg: #fcefee;
  --mbk-status-removed-edge: #ecc5c1;
  --mbk-status-removed-ink: #9b433c;
  --mbk-danger-bg: #fcf0ed;
  --mbk-danger-edge: #edcdc5;
  --mbk-danger-ink: #964334;
  --mb-radius: 10px;
  --mb-shadow: var(--chrome-shadow-soft);
  --mb-bg: var(--chrome-bg);
  --mb-surface: var(--chrome-surface);
  --mb-border: var(--chrome-border);
  --mb-text: var(--chrome-ink);
  --mb-muted: var(--chrome-muted);
  --mb-added: var(--mbk-accent-deep);
  --mb-added-soft: var(--mbk-accent-surface);
  --mb-changed: var(--mbk-status-changed-ink);
  --mb-changed-soft: var(--mbk-status-changed-bg);
  --mb-removed: var(--mbk-status-removed-ink);
  --mb-removed-soft: var(--mbk-status-removed-bg);
  --mb-ignored: var(--chrome-muted);
  --mb-ignored-soft: var(--chrome-hover);
}

/*
 * Preview tokens describe what a device screen shows, so they never follow the
 * interface appearance: a light preview inside a dark catalogue keeps its light
 * surface, ink and status indicators.
 */
:root {
  --mbk-screen-bg: #ffffff;
  --mbk-dark-screen-bg: #121514;
  --mbk-dark-screen-ink: #eef1ef;
  --mbk-device-body: #171a18;
  --mbk-device-notch: #0b0d0c;
  --mbk-device-home: rgba(20, 24, 20, 0.4);
  --mbk-device-light-close: #d9655b;
  --mbk-device-light-minimise: #dba43d;
  --mbk-device-light-expand: #50a86d;
}

*,
*::before,
*::after {
  box-sizing: border-box;
}

html,
body {
  margin: 0;
  min-height: 100%;
}

body {
  background: var(--chrome-bg);
  color: var(--chrome-ink);
  font-family: var(--sans);
  line-height: 1.5;
  -webkit-font-smoothing: antialiased;
}

a {
  color: inherit;
}

h1,
h2,
h3,
p {
  margin-top: 0;
}

@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
`;
