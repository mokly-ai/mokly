import type { TokenColorScheme } from "@mokly-cloud/tokens/tokens";
import { createContext, useContext } from "react";
import { useColorScheme } from "react-native";

/**
 * The scheme the application theme resolved, provided once for the whole
 * tree. Every surface reads this one value rather than subscribing to the
 * system preference itself: a separate subscription can miss a change that
 * arrives while another surface is re-rendering, and then the package chrome
 * and the cloud controls in its slots would disagree.
 */
export const ReaderSchemeContext = createContext<TokenColorScheme | undefined>(
  undefined,
);

/**
 * The system preference as the application theme reads it. A browser that
 * states no preference reads light.
 */
export function useSystemScheme(): TokenColorScheme {
  return useColorScheme() === "dark" ? "dark" : "light";
}

/**
 * The reader's color scheme, one reading shared by every surface that follows
 * it: the app chrome's tokens and controls, the hosted package's interface
 * `theme`, and the preview scheme an address without `scheme` falls back to.
 * Outside the application theme it falls back to the system preference.
 */
export function useReaderScheme(): TokenColorScheme {
  const provided = useContext(ReaderSchemeContext);
  const system = useSystemScheme();
  return provided ?? system;
}
