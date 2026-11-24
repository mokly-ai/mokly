/**
 * The role tables of the stylesheets that the palette generates: the source
 * of each declaration of the `@mokly/ui` theme and of the Markdown documents,
 * in declaration order. The roles without a Canvas source keep the fixed
 * values below, so this table is their palette definition.
 */
import {
  canvas,
  fixed,
  font,
  layer,
  literal,
  mix,
  person,
  ring,
  shaded,
  shadow,
  shared,
  themed,
  tint,
} from "./palette-sources.mjs";

/** The shadow of the floating panels, the popovers and the drawer. */
const FLOATING = shadow(
  [
    layer("0 1px 1px", 0.05),
    layer("0 10px 20px -6px", 0.08),
    layer("0 40px 80px -28px", 0.26),
  ],
  [
    ring(0.05),
    layer("0 14px 28px -8px", 0.55),
    layer("0 48px 96px -32px", 0.7),
  ],
);

/** The soft shadow of bars, cards and raised controls. */
const SOFT = shadow(
  [layer("0 1px 0", 0.03), layer("0 1px 2px", 0.06)],
  [ring(0.03), layer("0 1px 2px", 0.5)],
);

/** The shadow above a bottom sheet. */
const SHEET = shadow(
  [layer("0 -18px 40px -18px", 0.28)],
  [layer("0 -18px 40px -18px", 0.6)],
);

/** Each fixed status and validation role, with its Light and Dark value. */
const STATUS = [
  ["--mbk-status-changed-bg", "#fff7e6", "#332a15"],
  ["--mbk-status-changed-edge", "#ead6ac", "#5d4d24"],
  ["--mbk-status-changed-ink", "#805d1d", "#e6c179"],
  ["--mbk-status-removed-bg", "#fcefee", "#331f1d"],
  ["--mbk-status-removed-edge", "#ecc5c1", "#5e3b37"],
  ["--mbk-status-removed-ink", "#9b433c", "#f1a99c"],
  ["--mbk-danger-bg", "#fcf0ed", "#331f1d"],
  ["--mbk-danger-edge", "#edcdc5", "#5e3b37"],
  ["--mbk-danger-ink", "#964334", "#f1a99c"],
];

/** The shell's short names, each an alias of a theme role. */
const ALIASES = [
  ["--mb-shadow", "--chrome-shadow-soft"],
  ["--mb-bg", "--chrome-bg"],
  ["--mb-surface", "--chrome-surface"],
  ["--mb-border", "--chrome-border"],
  ["--mb-text", "--chrome-ink"],
  ["--mb-muted", "--chrome-muted"],
  ["--mb-added", "--mbk-accent-deep"],
  ["--mb-added-soft", "--mbk-accent-surface"],
  ["--mb-changed", "--mbk-status-changed-ink"],
  ["--mb-changed-soft", "--mbk-status-changed-bg"],
  ["--mb-removed", "--mbk-status-removed-ink"],
  ["--mb-removed-soft", "--mbk-status-removed-bg"],
  ["--mb-ignored", "--chrome-muted"],
  ["--mb-ignored-soft", "--chrome-hover"],
];

/** The shell's own roles. */
const SHELL = [
  themed("--chrome-bg", canvas("background")),
  themed("--chrome-surface", canvas("surface")),
  // The floating catalogue is a surface.
  themed("--chrome-raised", canvas("surface")),
  themed("--chrome-hover", mix("text", 5, "surface")),
  themed("--chrome-ink", canvas("text")),
  themed("--chrome-ink-2", canvas("textSecondary")),
  themed("--chrome-muted", canvas("textMuted")),
  themed("--chrome-border", canvas("border")),
  themed("--chrome-border-strong", mix("textMuted", 32, "surface")),
  themed("--chrome-control-edge", canvas("borderStrong")),
  themed("--chrome-accent", canvas("signalDeep")),
  themed("--chrome-count-bg", tint("text", 0.08)),
  themed("--chrome-scrim", shaded(0.4)),
  themed("--chrome-disabled-bg", fixed("#e6ebe7", "#1d1d20")),
  themed("--chrome-disabled-edge", fixed("#d7dfd9", "#34343a")),
  themed("--chrome-disabled-ink", fixed("#5d6f63", "#a1a1aa")),
  themed("--chrome-shadow", FLOATING),
  themed("--chrome-shadow-soft", SOFT),
  themed(
    "--chrome-shadow-press",
    fixed(
      "inset 0 1px 2px rgba(20, 28, 22, 0.14)",
      "inset 0 1px 2px rgba(0, 0, 0, 0.55)",
    ),
  ),
  themed("--chrome-shadow-drawer", FLOATING),
  themed("--chrome-shadow-sheet", SHEET),
  shared("--sans", font("sans")),
  shared("--mono", font("mono")),
  themed("--_mokly-private-on-ink", canvas("surface")),
  themed("--_mokly-private-on-accent-deep", canvas("surface")),
  themed("--_mokly-private-accent-default", canvas("signalDeep")),
  themed("--_mokly-private-accent-contrast-default", canvas("surface")),
  themed("--_mokly-private-accent-soft-default", canvas("signalSoft")),
  themed("--mbk-accent-deep", canvas("signalDeep")),
  themed("--mbk-accent-surface", canvas("signalSoft")),
  themed("--mbk-accent-edge", tint("signal", 0.45)),
  themed("--mbk-guide", canvas("border")),
  themed("--mbk-dot", canvas("dot")),
  ...STATUS.map(([property, light, dark]) =>
    themed(property, fixed(light, dark)),
  ),
  shared("--mb-radius", literal("10px")),
  ...ALIASES.map(([property, role]) =>
    shared(property, literal(`var(${role})`)),
  ),
];

/** A camelCase palette role as the kebab-case part of a property name. */
function kebab(role) {
  return role.replace(/[A-Z]/gu, (letter) => `-${letter.toLowerCase()}`);
}

/**
 * The roles of the theme: the colour scheme, every Canvas role of the
 * palette as `--cv-*`, its font stacks, then the shell's own roles.
 */
export function themeRoles(palette) {
  const { people, ...colors } = palette.light;
  return [
    themed("color-scheme", ({ appearance }) => appearance),
    ...Object.keys(colors).map((role) =>
      themed(`--cv-${kebab(role)}`, canvas(role)),
    ),
    ...Object.keys(people).flatMap((name) =>
      ["fill", "ink"].map((part) =>
        themed(`--cv-people-${name}-${part}`, person(name, part)),
      ),
    ),
    shared("--cv-sans", font("sans")),
    shared("--cv-mono", font("mono")),
    ...SHELL,
  ];
}

/** The preview tokens: what a frame shows, whatever the appearance. */
export const PREVIEW_ROLES = [
  ["--mbk-screen-bg", "#ffffff"],
  ["--mbk-screen-ink", "#1a1d1c"],
  ["--mbk-dark-screen-bg", "#121514"],
  ["--mbk-dark-screen-ink", "#eef1ef"],
  ["--mbk-highlight-scrim", "rgba(244, 246, 244, 0.72)"],
  ["--mbk-highlight-edge", "#336249"],
].map(([property, value]) => shared(property, literal(value)));

/** The roles of the Markdown documents, which the typography reads. */
export const DOCUMENT_ROLES = [
  themed("--document-bg", canvas("background")),
  themed("--document-surface", canvas("surface")),
  themed("--document-ink", canvas("text")),
  themed("--document-border", canvas("border")),
  themed("--document-accent", canvas("signalDeep")),
  shared("--document-sans", font("sans")),
  shared("--document-mono", font("mono")),
];
