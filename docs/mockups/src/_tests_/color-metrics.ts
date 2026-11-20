/** Relative luminance for the canonical opaque token palette. */
function luminance(hex: string): number {
  const rgb = [1, 3, 5].map((start) => {
    const value = parseInt(hex.slice(start, start + 2), 16) / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
}

/** WCAG contrast ratio for text/control regression tests. */
export function contrast(a: string, b: string): number {
  const values = [luminance(a), luminance(b)].sort((x, y) => x - y);
  return (values[1] + 0.05) / (values[0] + 0.05);
}

/** Chromium's computed representation of an opaque color token. */
export function rgb(hex: string): string {
  return (
    "rgb(" +
    [1, 3, 5]
      .map((start) => parseInt(hex.slice(start, start + 2), 16))
      .join(", ") +
    ")"
  );
}
