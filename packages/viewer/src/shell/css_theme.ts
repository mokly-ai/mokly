/** The Dark half of the semantic palette, selected by appearance. */

/**
 * Every role `css_tokens.ts` declares for Light is redeclared here for Dark,
 * so no role exists in one appearance only. The values are the swatches
 * recorded in `docs/protocol/mokly-viewer-palette.md`.
 */
const DARK_ROLES = `
  color-scheme: dark;
  --chrome-bg: #141816;
  --chrome-surface: #1e2421;
  --chrome-raised: #191e1b;
  --chrome-hover: #28302c;
  --chrome-ink: #eef1ef;
  --chrome-ink-2: #c3ccc7;
  --chrome-muted: #98a29c;
  --chrome-border: #313a35;
  --chrome-border-strong: #4b5650;
  --chrome-control-edge: #6f7a74;
  --chrome-accent: #a5cdb6;
  --chrome-count-bg: rgba(238, 241, 239, 0.1);
  --chrome-scrim: rgba(0, 0, 0, 0.55);
  --chrome-disabled-bg: #262d29;
  --chrome-disabled-edge: #3b443f;
  --chrome-disabled-ink: #8b968f;
  --chrome-shadow: 0 30px 90px rgba(0, 0, 0, 0.6);
  --chrome-shadow-soft: 0 1px 2px rgba(0, 0, 0, 0.5);
  --chrome-shadow-press: inset 0 1px 2px rgba(0, 0, 0, 0.55);
  --chrome-shadow-drawer: 0 18px 50px rgba(0, 0, 0, 0.6);
  --chrome-shadow-sheet: 0 6px 28px rgba(0, 0, 0, 0.55);
  --mokly-accent-default: #86b79b;
  --mokly-accent-contrast-default: #0e1a14;
  --mokly-accent-soft-default: rgba(134, 183, 155, 0.16);
  --mokly-accent: var(--mokly-accent-default);
  --mokly-accent-contrast: var(--mokly-accent-contrast-default);
  --mokly-accent-soft: var(--mokly-accent-soft-default);
  --mbk-accent-deep: #b6d8c4;
  --mbk-accent-surface: #24312a;
  --mbk-accent-edge: #3c5648;
  --mbk-guide: #2b342f;
  --mbk-dot: rgba(238, 241, 239, 0.07);
  --mbk-browser-bar: #262d29;
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
 */
export const SHELL_THEME_CSS = `
@media (prefers-color-scheme: dark) {
  :root[data-mokly-theme="auto"] {${DARK_ROLES}  }
}

:root[data-mokly-theme="dark"] {${DARK_ROLES}}
`;
