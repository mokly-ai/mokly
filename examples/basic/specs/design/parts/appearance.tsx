import { createContext, useContext, type ReactNode } from "react";

import type { ColorScheme } from "@mokly/mokly";

/** The interface appearance an artboard depicts, independent of preview scheme. */
export type DesignAppearance = ColorScheme;

/** The appearance selector setting a standalone catalogue can hold. */
export type AppearanceChoice = "auto" | "light" | "dark";

/**
 * Carries the renderer's `input.colorScheme` to the artboards below it. This is
 * a pass-through of the scheme Mokly already asks the renderer for, not a
 * second theme setting: a design page has exactly one requested scheme, and
 * `mokly build` generates one file per scheme from it.
 */
const RenderedScheme = createContext<DesignAppearance>("light");

/** The example renderer supplies the scheme Mokly requested for this file. */
export function DesignRenderedScheme({
  scheme,
  children,
}: {
  scheme: DesignAppearance;
  children: ReactNode;
}) {
  return <RenderedScheme value={scheme}>{children}</RenderedScheme>;
}

/** The scheme this generated file was rendered for. */
export function useRenderedAppearance(): DesignAppearance {
  return useContext(RenderedScheme);
}

/**
 * The depicted catalogue holds one scheme setting, so a screen with a dark
 * render shows it whenever the artboard is dark.
 */
export function useDarkPreview(): boolean {
  return useRenderedAppearance() === "dark";
}

/**
 * Every artboard states the appearance it draws on its own root, taken from the
 * scheme Mokly requested, so Browse's existing Light/Dark preview control swaps
 * to the matching generated file.
 */
export function DesignAppearanceScope({ children }: { children: ReactNode }) {
  return (
    <div className="ce-design" data-mbk-appearance={useRenderedAppearance()}>
      {children}
    </div>
  );
}
