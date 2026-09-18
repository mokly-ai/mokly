import type { ColorScheme, Viewport } from "@mokly/viewer";

/** Context supplied to a temporary consumer-owned document transformer. */
export interface CompatibilityTransformInput {
  /** Every generated and existing public route visible to the build. */
  availableRoutes: readonly string[];
  /** Color scheme used when resolving logical screen and use-case targets. */
  colorScheme: ColorScheme;
  /** Complete rendered document before final link and resource validation. */
  content: string;
  /** Catalogue routes mapped to their viewport-compatible artifacts. */
  logicalRoutes: Readonly<Record<string, string>>;
  /** Repository-relative output path for consumer metadata. */
  outputPath: string;
  /** Route relative to the configured mockups directory. */
  route: string;
  /** Viewport used when resolving logical screen and use-case targets. */
  viewport: Viewport;
}

/** Temporary, synchronous consumer bridge for already-authored documents. */
export type CompatibilityTransformer = (
  input: CompatibilityTransformInput,
) => string;
