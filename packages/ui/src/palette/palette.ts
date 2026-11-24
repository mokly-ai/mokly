/**
 * The named palettes of the Mokly design language, as plain data: the colour
 * roles of a light and a dark scheme, and the type families. The module
 * applies nothing. A consumer reads the values and declares them in its own
 * terms, such as the custom properties of a stylesheet or the theme of a
 * control library.
 */

/** The two colour schemes that every palette defines. */
export type PaletteScheme = "light" | "dark";

/** The colour of one person or agent on a shared canvas. */
export type PersonColor = {
  /** The cursor, the selection and the fill of the name label. */
  readonly fill: string;
  /** Text and glyphs on the fill. */
  readonly ink: string;
};

/**
 * The colour roles of a palette in one scheme, each an opaque `#rrggbb`
 * value. The surface, text and line roles come first; the signal and people
 * roles belong to the design file look.
 */
export type PaletteColors = {
  /** The page and the stage behind every frame and panel. */
  readonly background: string;
  /** The dots of the grid on the background. */
  readonly dot: string;
  /** Frames, panels and cards. */
  readonly surface: string;
  /** Popovers, menus and selected rows, one step above a surface. */
  readonly surfaceRaised: string;
  /** Fields, rails and panel feet, one step below a surface. */
  readonly surfaceMuted: string;
  /** Headings, body text and icons. */
  readonly text: string;
  /** Secondary text. */
  readonly textSecondary: string;
  /** Labels: the lightest text. */
  readonly textMuted: string;
  /** Decorative hairlines. */
  readonly border: string;
  /** Control boundaries and meaningful outlines, at 3:1 on every surface. */
  readonly borderStrong: string;
  /** Selections, handles, guides and size tags. */
  readonly signal: string;
  /** Text and glyphs on the signal colour. */
  readonly onSignal: string;
  /** Selected rows and approved states. */
  readonly signalSoft: string;
  /** Signal text and icons on every surface. */
  readonly signalDeep: string;
  /** The fill of a filled button. */
  readonly signalFill: string;
  /** Text and glyphs on the button fill, at 3:1. */
  readonly onSignalFill: string;
  /** The colours of the people and agents on a shared canvas. */
  readonly people: {
    readonly pink: PersonColor;
    readonly blue: PersonColor;
    readonly orange: PersonColor;
    readonly violet: PersonColor;
  };
};

/** The CSS font stacks of a palette. */
export type PaletteFonts = {
  /** Display and interface text. */
  readonly sans: string;
  /** Labels, size tags, paths and code. */
  readonly mono: string;
};

/** One named palette: its two schemes and its type families. */
export type Palette = {
  readonly light: PaletteColors;
  readonly dark: PaletteColors;
  readonly fonts: PaletteFonts;
};

/**
 * Canvas, the look of a design file: a dot-grid canvas, white frames with
 * hairlines, near-black ink, one signal green, and Geist with Geist Mono. The
 * dark scheme uses neutral graphite with a lighter signal green. Filled
 * buttons keep the same green fill and white label in both schemes.
 */
const canvas: Palette = {
  light: {
    background: "#f1f2ee",
    dot: "#c9cec5",
    surface: "#ffffff",
    surfaceRaised: "#ffffff",
    surfaceMuted: "#f7f8f5",
    text: "#0d1410",
    textSecondary: "#434c46",
    textMuted: "#626a64",
    border: "#e1e4de",
    borderStrong: "#626a64",
    signal: "#12b76a",
    onSignal: "#04130b",
    signalSoft: "#e3f6ec",
    signalDeep: "#067a45",
    signalFill: "#109f5c",
    onSignalFill: "#ffffff",
    people: {
      pink: { fill: "#d61f69", ink: "#ffffff" },
      blue: { fill: "#2563eb", ink: "#ffffff" },
      orange: { fill: "#f97316", ink: "#1f0e02" },
      violet: { fill: "#7c3aed", ink: "#ffffff" },
    },
  },
  dark: {
    background: "#111113",
    dot: "#2b2b30",
    surface: "#1b1b1e",
    surfaceRaised: "#232326",
    surfaceMuted: "#161618",
    text: "#f4f4f5",
    textSecondary: "#d4d4d8",
    textMuted: "#a1a1aa",
    border: "#2c2c31",
    borderStrong: "#71717a",
    signal: "#22c97d",
    onSignal: "#04130b",
    signalSoft: "#0f2a1d",
    signalDeep: "#5be3a0",
    signalFill: "#109f5c",
    onSignalFill: "#ffffff",
    people: {
      pink: { fill: "#f0528f", ink: "#111113" },
      blue: { fill: "#5b8cff", ink: "#111113" },
      orange: { fill: "#ff8b3d", ink: "#111113" },
      violet: { fill: "#a07aff", ink: "#111113" },
    },
  },
  fonts: {
    sans: '"Geist", ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif',
    mono: '"Geist Mono", ui-monospace, "SFMono-Regular", Menlo, monospace',
  },
};

/** Every named palette, by its name. */
export const palettes = { canvas } as const satisfies Record<string, Palette>;

/** The name of a palette. */
export type PaletteName = keyof typeof palettes;
