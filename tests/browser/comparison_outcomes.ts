/**
 * The outcome lines that the comparison band lists in its `Compared frames`
 * list, one for each compared frame in the canvas's order: the frame's name,
 * then the label of its view, such as `Desktop · Light · Screen changed`.
 */

/**
 * The lines of a screen's shown frames: its Light row, Desktop beside
 * Mobile, then its Dark row, unless `schemes` names fewer rows.
 */
export function screenOutcomes(
  label: string,
  schemes: readonly ("Dark" | "Light")[] = ["Light", "Dark"],
): string[] {
  return schemes.flatMap((scheme) =>
    ["Desktop", "Mobile"].map(
      (viewport) => `${viewport} · ${scheme} · ${label}`,
    ),
  );
}

/** The lines of one row of a variant set: its Light frame, then its Dark frame. */
export function rowOutcomes(title: string, label: string): string[] {
  return ["Light", "Dark"].map((scheme) => `${title} · ${scheme} · ${label}`);
}
