import { transform } from "lightningcss";

import { VIEWER_DIRECTORY } from "@mokly/viewer/data";

/** The address of the font in its authored rule, which sits beside the font. */
const FONT_SOURCE = 'url("./InterVariable.woff2")';

/** The family name of the shell font in an embedded root. */
const EMBEDDED_FAMILY = '"Mokly Inter"';

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
  }).code.toString();
  return `${face.replaceAll('"Inter"', EMBEDDED_FAMILY)}\n${rules}`;
}
