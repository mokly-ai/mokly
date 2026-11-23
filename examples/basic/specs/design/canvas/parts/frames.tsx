import type { ReactNode } from "react";

import type { CanvasFrameProps } from "../../library/canvas/canvas-frame.js";
import { FRAME_SIZES } from "../../library/canvas/frame_sizes.js";
import { DesignInstances } from "../../library/composition.js";
import type { ArtboardViewport } from "../../parts/artboards.js";

/** A frame's colour scheme. */
export type FrameScheme = "light" | "dark";

/** A version of a changed entry: the version before, or the current one. */
export type FrameVersion = "after" | "before";

/**
 * One frame of a stage: its identity, label, nominal size, and sketch. A
 * component's frame takes the measured size of its document, which can
 * hold fractions of a pixel.
 */
export interface CanvasFrameSpec {
  /** The frame's id, unique on the stage, such as `desktop-light`. */
  id: string;
  kind: CanvasFrameProps["kind"];
  scheme: FrameScheme;
  label: string;
  width: number;
  height: number;
  content: ReactNode;
  /** How the frame shows both versions in a comparison; the current one is `content`. */
  compare?: CanvasFrameProps["compare"];
  /** The version before, which a comparison shows under the current one. */
  before?: ReactNode;
  /** The version that a frame of Side by side shows. */
  side?: FrameVersion;
  /** The saved variant that a frame of a variant set shows, by its slug. */
  variant?: string;
  /**
   * The frame keeps its light view under Dark, because its entry has no dark
   * view, and its label names that fallback.
   */
  lightOnly?: boolean;
}

/**
 * A frame's size as its size tag, its selection, and Inspect show it: in
 * whole CSS pixels.
 */
export function frameSize({ height, width }: CanvasFrameSpec) {
  return { width: Math.round(width), height: Math.round(height) };
}

/** The name of each scheme, as a frame's label and Inspect show it. */
export const SCHEMES: Record<FrameScheme, string> = {
  light: "Light",
  dark: "Dark",
};
const VIEWPORTS: Record<ArtboardViewport, string> = {
  desktop: "Desktop",
  mobile: "Mobile",
};

/** A screen's frame of one viewport and scheme, from its content. */
function screenFrame(
  viewport: ArtboardViewport,
  scheme: FrameScheme,
  content: ReactNode,
): CanvasFrameSpec {
  return {
    id: `${viewport}-${scheme}`,
    kind: viewport,
    scheme,
    label: `${VIEWPORTS[viewport]} · ${SCHEMES[scheme]}`,
    ...FRAME_SIZES[viewport],
    content,
  };
}

/** The viewports and schemes of a screen's frames, in their stage order. */
function frameAxes(schemes: readonly FrameScheme[]) {
  return schemes.flatMap((scheme) =>
    (["desktop", "mobile"] as const).map((viewport) => ({ scheme, viewport })),
  );
}

/**
 * A screen's frames, Desktop beside Mobile and Light above Dark, from a
 * render of its sketch by viewport and scheme. A light-only screen has only
 * the Light row.
 */
export function screenFrames(
  render: (viewport: ArtboardViewport, scheme: FrameScheme) => ReactNode,
  schemes: readonly FrameScheme[] = ["light", "dark"],
): CanvasFrameSpec[] {
  return frameAxes(schemes).map(({ scheme, viewport }) =>
    screenFrame(
      viewport,
      scheme,
      <DesignInstances name={`${viewport}-${scheme}`}>
        {render(viewport, scheme)}
      </DesignInstances>,
    ),
  );
}

/** A render of each version of a changed screen's sketch. */
export type VersionRender = (
  viewport: ArtboardViewport,
  scheme: FrameScheme,
  version: FrameVersion,
) => ReactNode;

/** One version's sketch in the frame of one viewport and scheme. */
function versionSketch(
  render: VersionRender,
  viewport: ArtboardViewport,
  scheme: FrameScheme,
  version: FrameVersion,
) {
  return (
    <DesignInstances name={`${viewport}-${scheme}-${version}`}>
      {render(viewport, scheme, version)}
    </DesignInstances>
  );
}

/**
 * A changed screen's frames in a comparison that applies to every frame:
 * each frame holds the version before and the current version.
 */
export function compareFrames(
  render: VersionRender,
  compare: NonNullable<CanvasFrameProps["compare"]>,
): CanvasFrameSpec[] {
  return frameAxes(["light", "dark"]).map(({ scheme, viewport }) => ({
    ...screenFrame(
      viewport,
      scheme,
      versionSketch(render, viewport, scheme, "after"),
    ),
    compare,
    before: versionSketch(render, viewport, scheme, "before"),
  }));
}

/**
 * A changed screen's frames in Side by side: each frame as a pair, the
 * version before beside the current version. The stage shows the pair of
 * the compared frame.
 */
export function sideBySideFrames(render: VersionRender): CanvasFrameSpec[] {
  return frameAxes(["light", "dark"]).flatMap(({ scheme, viewport }) =>
    (["before", "after"] as const).map((side) => ({
      ...screenFrame(
        viewport,
        scheme,
        versionSketch(render, viewport, scheme, side),
      ),
      id: `${viewport}-${scheme}-${side}`,
      side,
    })),
  );
}

/**
 * One saved variant of a component, or the component's own example, which
 * its title names, as its frames depict it, with the size of its document.
 */
export interface ComponentVariantSketch {
  slug: string;
  title: string;
  /** The document's measured size in its desktop view, in CSS pixels. */
  size: { width: number; height: number };
  render: () => ReactNode;
}

/**
 * Rows of a component's variant set: one row per sketch, Light beside Dark,
 * each frame at the measured size of the document that it holds.
 */
export function componentFrames(
  variants: readonly ComponentVariantSketch[],
): CanvasFrameSpec[] {
  return variants.flatMap((variant) =>
    (["light", "dark"] as const).map((scheme) => ({
      id: `${variant.slug}-${scheme}`,
      kind: "component" as const,
      scheme,
      label: `${variant.title} · ${SCHEMES[scheme]}`,
      variant: variant.slug,
      ...variant.size,
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
