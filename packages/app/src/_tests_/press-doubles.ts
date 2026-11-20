import type { Button as PackageButton } from "@firna/ui/button";
import type { ComponentProps, ReactNode } from "react";

/**
 * Stand-ins for the two modules a press passes through that Node cannot run:
 * the package Button, which only a page can press, and Expo Router, which
 * cannot load outside its runtime. A logic test resolves `@firna/ui/button` and
 * `expo-router` to this module, so everything between them — the screen,
 * `Action` and `follow()` — runs as the application wrote it.
 */

/** The glyph the package Button draws before its label. */
type Glyph = ComponentProps<typeof PackageButton>["icon"];

/**
 * One Button the render drew: its label, its glyph, its test ID and the press
 * it took.
 */
export interface DrawnButton {
  label: string;
  icon?: Glyph;
  testID?: string;
  onPress?: () => void;
}

/** Every Button drawn and every route pushed since the last `forget()`. */
export const seen = {
  buttons: [] as DrawnButton[],
  pushed: [] as string[],
};

/** Start again before the next render. */
export function forget(): void {
  seen.buttons.length = 0;
  seen.pushed.length = 0;
}

/**
 * The package Button, reduced to the label and glyph it shows and the press it
 * takes.
 */
export function Button(props: {
  children?: ReactNode;
  icon?: Glyph;
  testID?: string;
  onPress?: () => void;
}): null {
  seen.buttons.push({
    label: String(props.children),
    icon: props.icon,
    testID: props.testID,
    onPress: props.onPress,
  });
  return null;
}

/** Expo Router's hook, reduced to the one operation `follow()` uses. */
export function useRouter(): { push: (href: string) => void } {
  return { push: (href) => void seen.pushed.push(href) };
}
