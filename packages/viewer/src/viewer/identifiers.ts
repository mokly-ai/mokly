let sequence = 0;
/** Namespace only package-owned IDs; slot DOM remains entirely host-owned. */
export function identifierScope(root: HTMLElement): () => void {
  const prefix = `mokly-${++sequence}-`;
  return () => {
    const owned = [
      ...root.querySelectorAll<HTMLElement>(
        "[id], [aria-controls], [aria-labelledby], [href^='#']",
      ),
    ].filter((element) => !element.closest("[data-mokly-slot]"));
    for (const element of owned) {
      if (element.id && !element.id.startsWith(prefix))
        element.id = prefix + element.id;
      for (const attribute of ["aria-controls", "aria-labelledby"]) {
        const value = element.getAttribute(attribute);
        if (value)
          element.setAttribute(
            attribute,
            value
              .split(" ")
              .map((id) => (id.startsWith(prefix) ? id : prefix + id))
              .join(" "),
          );
      }
      const href = element.getAttribute("href");
      if (href?.startsWith("#") && !href.startsWith(`#${prefix}`))
        element.setAttribute("href", `#${prefix}${href.slice(1)}`);
    }
  };
}
