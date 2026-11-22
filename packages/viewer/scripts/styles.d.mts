/**
 * The standalone stylesheet: the shell fonts at their delivery path, then the
 * package stylesheet unchanged.
 */
export function standaloneStyles(font: string, packageCss: string): string;

/**
 * The stylesheet of an embedded root: the shell fonts under family names of
 * their own at their packaged address, then the package rules, which name the
 * fonts by those families.
 */
export function embeddedStyles(font: string, packageCss: string): string;
