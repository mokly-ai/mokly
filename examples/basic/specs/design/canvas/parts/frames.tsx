import type { ReactNode } from "react";

import type { CanvasFrameProps } from "../../library/canvas/canvas-frame.js";
import { FRAME_SIZES } from "../../library/canvas/frame_sizes.js";
import { DesignInstances } from "../../library/composition.js";
import type { ArtboardViewport } from "../../parts/shell.js";

/** A frame's colour scheme. */
export type FrameScheme = "light" | "dark";

/** One frame of a stage: its identity, label, nominal size, and sketch. */
export interface CanvasFrameSpec {
  /** The frame's id, unique on the stage, such as `desktop-light`. */
  id: string;
  kind: CanvasFrameProps["kind"];
  scheme: FrameScheme;
  label: string;
  width: number;
  height: number;
  content: ReactNode;
}

const SCHEMES: Record<FrameScheme, string> = { light: "Light", dark: "Dark" };
const VIEWPORTS: Record<ArtboardViewport, string> = {
  desktop: "Desktop",
  mobile: "Mobile",
};

/**
 * A screen's frames, Desktop beside Mobile and Light above Dark, from a
 * render of its sketch by viewport and scheme. A light-only screen has only
 * the Light row.
 */
export function screenFrames(
  render: (viewport: ArtboardViewport, scheme: FrameScheme) => ReactNode,
  schemes: readonly FrameScheme[] = ["light", "dark"],
): CanvasFrameSpec[] {
  return schemes.flatMap((scheme) =>
    (["desktop", "mobile"] as const).map((viewport) => ({
      id: `${viewport}-${scheme}`,
      kind: viewport,
      scheme,
      label: `${VIEWPORTS[viewport]} · ${SCHEMES[scheme]}`,
      ...FRAME_SIZES[viewport],
      content: (
        <DesignInstances name={`${viewport}-${scheme}`}>
          {render(viewport, scheme)}
        </DesignInstances>
      ),
    })),
  );
}

/** One saved variant of a component, as its frames depict it. */
export interface ComponentVariantSketch {
  slug: string;
  title: string;
  render: () => ReactNode;
}

/**
 * A component's variant set: one row per saved variant, Light beside Dark,
 * each frame at the variant document's nominal size.
 */
export function componentFrames(
  variants: readonly ComponentVariantSketch[],
  size: { width: number; height: number },
): CanvasFrameSpec[] {
  return variants.flatMap((variant) =>
    (["light", "dark"] as const).map((scheme) => ({
      id: `${variant.slug}-${scheme}`,
      kind: "component" as const,
      scheme,
      label: `${variant.title} · ${SCHEMES[scheme]}`,
      ...size,
      content: (
        <DesignInstances name={`${variant.slug}-${scheme}`}>
          {variant.render()}
        </DesignInstances>
      ),
    })),
  );
}

/**
 * A page or a Markdown document as one reading frame, which reads in the
 * catalogue's own appearance.
 */
export function readingFrame(
  label: string,
  content: ReactNode,
  size: { width: number; height: number },
  scheme: FrameScheme,
): CanvasFrameSpec {
  return {
    id: "reading",
    kind: "document",
    scheme,
    label,
    ...size,
    content,
  };
}
