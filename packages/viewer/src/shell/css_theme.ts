/** The Dark half of the semantic palette, selected by appearance. */

/**
 * Every role `css_tokens.ts` declares for Light is redeclared here for Dark,
 * so no role exists in one appearance only. The values are the swatches
 * recorded in `docs/protocol/mokly-viewer-palette.md`.
 */
const DARK_ROLES = `
  color-scheme: dark;
  --chrome-bg: #161512;
  --chrome-surface: #221f1b;
  --chrome-raised: #1c1b17;
  --chrome-hover: #2c2925;
  --chrome-ink: #f0ece4;
  --chrome-ink-2: #b2aba0;
  --chrome-muted: #b2aba0;
  --chrome-border: #302d28;
  --chrome-border-strong: #8b8478;
  --chrome-control-edge: #8b8478;
  --chrome-accent: #a5cdb6;
  --chrome-brand: #a3cdb4;
  --chrome-count-bg: rgba(240, 236, 228, 0.1);
  --chrome-scrim: rgba(0, 0, 0, 0.55);
  --chrome-disabled-bg: #1c1b17;
  --chrome-disabled-edge: #302d28;
  --chrome-disabled-ink: #b2aba0;
  --chrome-shadow: 0 30px 90px rgba(0, 0, 0, 0.6);
  --chrome-shadow-soft: 0 1px 2px rgba(0, 0, 0, 0.5);
  --chrome-shadow-press: inset 0 1px 2px rgba(0, 0, 0, 0.55);
  --chrome-shadow-drawer: 0 18px 50px rgba(0, 0, 0, 0.6);
  --chrome-shadow-sheet: 0 6px 28px rgba(0, 0, 0, 0.55);
  --_mokly-private-on-ink: #221f1b;
  --_mokly-private-on-accent-deep: #0e1a14;
  --_mokly-private-accent-default: #86b79b;
  --_mokly-private-accent-contrast-default: #0e1a14;
  --_mokly-private-accent-soft-default: rgba(134, 183, 155, 0.16);
  --mokly-accent: var(--_mokly-private-accent-default);
  --mokly-accent-contrast: var(--_mokly-private-accent-contrast-default);
  --mokly-accent-soft: var(--_mokly-private-accent-soft-default);
  --mbk-accent-deep: #b6d8c4;
  --mbk-accent-surface: #24312a;
  --mbk-accent-edge: #3c5648;
  --mbk-guide: #302d28;
  --mbk-dot: rgba(240, 236, 228, 0.07);
  --mbk-browser-bar: #1c1b17;
  --mbk-status-changed-bg: #332a15;
  --mbk-status-changed-edge: #5d4d24;
  --mbk-status-changed-ink: #e6c179;
  --mbk-status-removed-bg: #331f1d;
  --mbk-status-removed-edge: #5e3b37;
  --mbk-status-removed-ink: #f1a99c;
  --mbk-danger-bg: #331f1d;
  --mbk-danger-edge: #5e3b37;
  --mbk-danger-ink: #f1a99c;
`;

/**
 * Auto follows the reader's system through CSS alone, so a dark reader never
 * sees a light first paint and no script decides the appearance. An explicit
 * choice wins over the system in either direction, and both rules select the
 * root that states the appearance, never the host document.
 * Standalone Auto depends on `appearance-startup.js` restoring the root mark;
 * embedded roots receive that mark from their React `theme` prop instead.
 */
export const SHELL_THEME_CSS = `
@media (prefers-color-scheme: dark) {
  :root[data-mokly-theme="auto"] {${DARK_ROLES}  }
}

:root[data-mokly-theme="dark"] {${DARK_ROLES}}
`;
