import { transform } from "lightningcss";

import { VIEWER_DIRECTORY } from "@mokly/viewer/data";

/** The address of the font in its authored rule, which sits beside the font. */
const FONT_SOURCE = 'url("./InterVariable.woff2")';

/** The family name of the shell font in an embedded root. */
const EMBEDDED_FAMILY = '"Mokly Inter"';

/**
 * The three public accent overrides, each with the private default of the
 * current appearance, which the theme declares on every shell root.
 */
const ACCENT_OVERRIDES = new Map([
  ["--mokly-accent", "--_mokly-private-accent-default"],
  ["--mokly-accent-contrast", "--_mokly-private-accent-contrast-default"],
  ["--mokly-accent-soft", "--_mokly-private-accent-soft-default"],
]);

/** The `@font-face` rule of the shell font, at the address of one delivery. */
function fontFace(font, address) {
  const rule = /@font-face\s*\{[^}]*\}/u.exec(font)?.[0];
  if (!rule?.includes(FONT_SOURCE))
    throw new Error(`The shell font rule does not read ${FONT_SOURCE}.`);
  return rule.replace(FONT_SOURCE, `url("${address}")`);
}

/**
 * The standalone stylesheet that Serve and `build` deliver as
 * `/mokly-viewer/shell.css`: the shell font at its delivery path, then the
 * package stylesheet unchanged.
 */
export function standaloneStyles(font, packageCss) {
  const address = `/${VIEWER_DIRECTORY}/fonts/InterVariable.woff2`;
  return `${fontFace(font, address)}\n${packageCss}`;
}

/**
 * Drop each declaration of a public accent override, so that a host's value
 * on an ancestor inherits into the root, and let each use fall back to the
 * default that the theme restates for each appearance. A dark root without a
 * host value therefore keeps its dark accent.
 */
const ACCENT_FALLBACKS = {
  Declaration: {
    custom: Object.fromEntries(
      [...ACCENT_OVERRIDES.keys()].map((name) => [name, () => []]),
    ),
  },
  Variable(variable) {
    const fallback = ACCENT_OVERRIDES.get(variable.name.ident);
    if (fallback === undefined || variable.fallback) return undefined;
    return { raw: `var(${variable.name.ident}, var(${fallback}))` };
  },
};

/**
 * The stylesheet of an embedded root. Its font takes a family name of its
 * own, so a host's own Inter keeps its file, and reads the packaged assets
 * next to the stylesheet. The package rules need no scope: none of them
 * reaches the host page or host slot content.
 */
export function embeddedStyles(font, packageCss) {
  const face = fontFace(font, "./assets/fonts/InterVariable.woff2");
  const rules = transform({
    code: Buffer.from(packageCss.replaceAll('"Inter"', EMBEDDED_FAMILY)),
    filename: "styles.css",
    visitor: ACCENT_FALLBACKS,
  }).code.toString();
  return `${face.replaceAll('"Inter"', EMBEDDED_FAMILY)}\n${rules}`;
}
