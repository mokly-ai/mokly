import { tokens } from "@mokly-cloud/tokens/tokens";
import { useWindowDimensions } from "react-native";

/** Below this width the product uses its compact composition. */
export const breakpoint = parseFloat(tokens.layout.breakpoint);

/**
 * Whether this surface renders the compact composition: the mobile top bar, the
 * full-screen settings layer and 44px touch targets. One hook answers for the
 * whole application so a screen never decides for itself.
 */
export function useCompact(): boolean {
  const { width } = useWindowDimensions();
  return width < breakpoint;
}
