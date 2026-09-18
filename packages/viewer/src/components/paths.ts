import type { ColorScheme, Viewport } from "../data/axes.js";

/** Component pages keep every saved variant in its own portable fragment directory. */
export function componentFragmentRoute(
  route: string,
  variantId: string,
  viewport: Viewport,
  colorScheme: ColorScheme = "light",
): string {
  return route.replace(
    /\.html$/,
    `.variants/${variantId}.${viewport}${colorScheme === "dark" ? ".dark" : ""}.html`,
  );
}
