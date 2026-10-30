/**
 * The standalone stylesheet: the shell font at its delivery path, then the
 * package stylesheet unchanged.
 */
export function standaloneStyles(font: string, packageCss: string): string;

/**
 * The stylesheet of an embedded root: the shell font under its own family
 * name at its packaged address, then the package stylesheet with fallbacks
 * that let a host's accent overrides inherit.
 */
export function embeddedStyles(font: string, packageCss: string): string;
