/**
 * The outcome lines that the comparison band lists in its `Compared frames`
 * list, one for each compared frame in the canvas's order: the frame's name,
 * then the label of its view, such as `Desktop · Light · Screen changed`.
 */

/**
 * The lines of a screen's shown frames: its Light row, Desktop beside
 * Mobile, then its Dark row, unless `schemes` names fewer rows or
 * `viewports` fewer columns, as a link that names one viewport shows.
 */
export function screenOutcomes(
  label: string,
  schemes: readonly ("Dark" | "Light")[] = ["Light", "Dark"],
  viewports: readonly ("Desktop" | "Mobile")[] = ["Desktop", "Mobile"],
): string[] {
  return schemes.flatMap((scheme) =>
    viewports.map((viewport) => `${viewport} · ${scheme} · ${label}`),
  );
}

/** The lines of one row of a variant set: its Light frame, then its Dark frame. */
export function rowOutcomes(title: string, label: string): string[] {
  return ["Light", "Dark"].map((scheme) => `${title} · ${scheme} · ${label}`);
}
