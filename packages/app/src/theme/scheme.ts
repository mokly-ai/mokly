import type { TokenColorScheme } from "@mokly-cloud/tokens/tokens";
import { createContext, useContext } from "react";
import { useColorScheme } from "react-native";

/**
 * The two schemes the application reads, resolved once for the whole tree,
 * and the way to choose the Theme. Every surface reads these values rather
 * than subscribing to the system preference itself: a separate subscription
 * can miss a change that arrives while another surface is re-rendering, and
 * then the package chrome and the cloud controls in its slots would disagree.
 */
export interface ReaderSchemes {
  /** The scheme the application is drawn in: the Theme, else `system`. */
  app: TokenColorScheme;
  /** The system preference, light when the browser states none. */
  system: TokenColorScheme;
  /** Choose the Theme on this device, in place of any earlier choice. */
  choose: (scheme: TokenColorScheme) => void;
}

export const ReaderSchemeContext = createContext<ReaderSchemes | undefined>(
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
 * The scheme the application is drawn in, one reading shared by every surface
 * that follows it: the app chrome's tokens and controls and the hosted
 * package's interface `theme`. It is the reader's Theme, or their system
 * preference until they choose one. Outside the application theme it falls
 * back to the system preference.
 */
export function useReaderScheme(): TokenColorScheme {
  const provided = useContext(ReaderSchemeContext);
  const system = useSystemScheme();
  return provided?.app ?? system;
}

/**
 * The scheme an address without `scheme` shows its previews in: the system
 * preference, whatever Theme the reader chose, because the Theme sets the
 * application's chrome and never the preview documents.
 */
export function usePreviewScheme(): TokenColorScheme {
  const provided = useContext(ReaderSchemeContext);
  const system = useSystemScheme();
  return provided?.system ?? system;
}

/** Outside the application theme there is no Theme to choose. */
function chooseNothing(): void {}

/**
 * The Theme choice: the scheme it shows as selected, which is the scheme the
 * application is drawn in, and the way to choose another.
 */
export function useThemeChoice(): {
  scheme: TokenColorScheme;
  choose: (scheme: TokenColorScheme) => void;
} {
  const provided = useContext(ReaderSchemeContext);
  const system = useSystemScheme();
  return {
    scheme: provided?.app ?? system,
    choose: provided?.choose ?? chooseNothing,
  };
}
