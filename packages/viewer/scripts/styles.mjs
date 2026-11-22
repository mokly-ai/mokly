import { transform } from "lightningcss";

import { VIEWER_DIRECTORY } from "@mokly/viewer/data";

/**
 * The shell faces: the family that the package rules name, the family that
 * an embedded root names instead, and the file that the authored rule reads
 * beside it.
 */
const FACES = [
  {
    family: '"Geist"',
    embedded: '"Mokly Geist"',
    file: "Geist-Variable.woff2",
  },
  {
    family: '"Geist Mono"',
    embedded: '"Mokly Geist Mono"',
    file: "GeistMono-Variable.woff2",
  },
];

/**
 * The `@font-face` rule of each shell face, in face order, with each face at
 * the address of one delivery under `directory`.
 */
function fontFaces(font, directory) {
  const rules = font.match(/@font-face\s*\{[^}]*\}/gu) ?? [];
  return FACES.map(({ file }) => {
    const source = `url("./${file}")`;
    const rule = rules.find((candidate) => candidate.includes(source));
    if (!rule) throw new Error(`No shell font rule reads ${source}.`);
    return rule.replace(source, `url("${directory}/${file}")`);
  }).join("\n");
}

/** CSS with each shell family renamed to the family of an embedded root. */
function embeddedFamilies(css) {
  return FACES.reduce(
    (renamed, { family, embedded }) => renamed.replaceAll(family, embedded),
    css,
  );
}

/**
 * The standalone stylesheet that Serve and `build` deliver as
 * `/mokly-viewer/shell.css`: the shell fonts at their delivery path, then the
 * package stylesheet unchanged.
 */
export function standaloneStyles(font, packageCss) {
  const faces = fontFaces(font, `/${VIEWER_DIRECTORY}/fonts`);
  return `${faces}\n${packageCss}`;
}

/**
 * The stylesheet of an embedded root. Its fonts take family names of their
 * own, so a host's own Geist keeps its file, and read the packaged assets
 * next to the stylesheet. The package rules need no scope: none of them
 * reaches the host page or host slot content.
 */
export function embeddedStyles(font, packageCss) {
  const faces = fontFaces(font, "./assets/fonts");
  const rules = transform({
    code: Buffer.from(embeddedFamilies(packageCss)),
    filename: "styles.css",
  }).code.toString();
  return `${embeddedFamilies(faces)}\n${rules}`;
}
