/**
 * The standalone stylesheet: the shell font at its delivery path, then the
 * package stylesheet unchanged.
 */
export function standaloneStyles(font: string, packageCss: string): string;

/**
 * The stylesheet of an embedded root: the shell font under its own family
 * name at its packaged address, then the package rules, which name the font
 * by that family.
 */
export function embeddedStyles(font: string, packageCss: string): string;
