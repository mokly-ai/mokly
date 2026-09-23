/** Preview surfaces follow the selected document, independently of shell theme. */
export const SHELL_PREVIEW_SCHEME_CSS = `
.mbk-frag {
  color-scheme: light;
  background: var(--mbk-screen-bg);
}

.phone-screen {
  background: var(--mbk-screen-bg);
}

.phone-status {
  color: var(--mbk-screen-ink);
}

.phone-home {
  background: var(--mbk-device-home);
}

.browser-viewport {
  background: var(--mbk-screen-bg);
}

.mb-pane-doc {
  background: var(--mbk-screen-bg);
}

[data-preview-color-scheme="dark"] .mbk-frag {
  color-scheme: dark;
  background: var(--mbk-dark-screen-bg);
}

[data-preview-color-scheme="dark"] .phone-screen {
  background: var(--mbk-dark-screen-bg);
}

[data-preview-color-scheme="dark"] .phone-screen::after {
  content: "";
  position: absolute;
  inset: 0;
  border-radius: inherit;
  box-shadow: inset 0 0 0 1px
    color-mix(
      in srgb,
      var(--mbk-dark-screen-ink) 12%,
      var(--mbk-dark-screen-bg)
    );
  pointer-events: none;
}

[data-preview-color-scheme="dark"] .phone-status {
  color: var(--mbk-dark-screen-ink);
}

[data-preview-color-scheme="dark"] .phone-home {
  background: color-mix(in srgb, var(--mbk-dark-screen-ink) 40%, transparent);
}

[data-preview-color-scheme="dark"] .browser-viewport {
  background: var(--mbk-dark-screen-bg);
}

.mb-pane-doc[data-preview-color-scheme="dark"] {
  background: var(--mbk-dark-screen-bg);
}
`;
