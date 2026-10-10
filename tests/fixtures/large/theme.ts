/** Fixture-owned @firna/ui overrides, included in template identity. */
export const tokens = {
  fonts: {
    sans: '"Inter", system-ui, sans-serif',
    mono: 'SFMono-Regular, Consolas, "Liberation Mono", Menlo, monospace',
  },
} as const;

/** Dark overrides used by every generated dark view. */
export const darkTokens = {
  ...tokens,
  colors: {
    bg: "#121514",
    bg2: "#1b201d",
    accent: "#7fae95",
    border: "#2a312d",
    border2: "#2a312d",
    controlBorder: "#2a312d",
    faint: "#9aa39d",
    ink: "#eef1ef",
    ink2: "#c2cac4",
    muted: "#9aa39d",
    placeholder: "#9aa39d",
    soft: "#1b201d",
    surface: "#1b201d",
  },
} as const;
