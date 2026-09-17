/** Design tokens, font, and base element styles for the served shell. */

/** Token and base styles opening the shell stylesheet. */
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
  --chrome-ink: #1a1d1c;
  --chrome-ink-2: #4a4f4d;
  --chrome-muted: #7d8480;
  --chrome-border: #e3e5e0;
  --chrome-border-strong: #c8ccc4;
  --chrome-accent: #2a4733;
  --chrome-shadow: 0 30px 90px rgba(20, 28, 22, 0.14);
  --sans: "Inter", ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont,
    "Segoe UI", sans-serif;
  --mono: "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace;
  --mokly-accent: #4f7864;
  --mokly-accent-contrast: #ffffff;
  --mokly-accent-soft: rgba(79, 120, 100, 0.1);
  --mbk-accent-deep: #2f5945;
  --mbk-dark-screen-bg: #121514;
  --mbk-dark-screen-ink: #eef1ef;
  --mb-bg: var(--chrome-bg);
  --mb-surface: var(--chrome-surface);
  --mb-border: var(--chrome-border);
  --mb-text: var(--chrome-ink);
  --mb-muted: var(--chrome-muted);
  --mb-radius: 10px;
  --mb-shadow: 0 1px 2px rgba(20, 28, 22, 0.08);
  --mb-added: #1d7a3d;
  --mb-added-soft: #e3f0e7;
  --mb-changed: #9a6b00;
  --mb-changed-soft: #f6ecd4;
  --mb-removed: #b3261e;
  --mb-removed-soft: #f7e2e0;
  --mb-ignored: #6c6862;
  --mb-ignored-soft: #edebe8;
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
