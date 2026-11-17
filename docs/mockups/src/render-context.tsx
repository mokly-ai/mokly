import type { ColorScheme, Viewport } from "@mokly/mokly";
import { createContext, useContext } from "react";

/** The generated document that a render draws. */
export interface MockupRenderContextValue {
  colorScheme: ColorScheme;
  viewport: Viewport;
  /**
   * The entry's effective path, a saved variant's own path included, such as
   * `design/button/primary`. Mokly passes it only to the renderer, so the
   * renderer's wrapper provides it here for the resource paths.
   */
  path: string;
}

/** Provided by the renderer's wrapper around each screen and component page. */
export const MockupRenderContext = createContext<
  MockupRenderContextValue | undefined
>(undefined);

/** Read the axes and the entry path of the document Mokly is rendering. */
export function useMockupRenderContext(): MockupRenderContextValue {
  const value = useContext(MockupRenderContext);
  if (value === undefined)
    throw new Error("Render this inside the mockup renderer's document");
  return value;
}
