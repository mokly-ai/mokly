export function flatCss(css: string): string {
  return css.replace(/\s+/g, " ").replace(/\(\s/g, "(").replace(/\s\)/g, ")");
}

/**
 * The selector of every declaration block that reads a dark screen token, used
 * to prove the dark palette cannot reach the light render.
 */
export function darkTokenSelectors(css: string): string[] {
  return css
    .split("}")
    .filter((block) => block.includes("var(--mbk-dark-screen-"))
    .map((block) => block.slice(0, block.lastIndexOf("{")).trim());
}

/** The details inspector alone, so top-bar chips cannot satisfy a check. */
