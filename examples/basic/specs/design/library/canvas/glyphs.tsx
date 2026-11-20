import type { ReactNode } from "react";

/** The glyphs that the Canvas parts draw, on a 16-unit grid. */
export type CanvasGlyphName =
  | "changes"
  | "chevron"
  | "chevron-up"
  | "close"
  | "component"
  | "dark"
  | "desktop"
  | "document"
  | "fit"
  | "folder-branch"
  | "grip"
  | "highlight"
  | "inspect"
  | "layers"
  | "light"
  | "minus"
  | "mobile"
  | "plus"
  | "refresh";

/**
 * The strokes of each glyph. The module creates no element while it loads:
 * Playwright's test discovery on Node 22 fails when the JSX runtime runs
 * during an import.
 */
const STROKES: Record<CanvasGlyphName, () => ReactNode> = {
  changes: () => (
    <>
      <rect x="2.2" y="2.2" width="11.6" height="11.6" rx="2.6" />
      <path d="M8 2.2v11.6" />
      <path
        d="M8 2.2h3.2a2.6 2.6 0 0 1 2.6 2.6v6.4a2.6 2.6 0 0 1-2.6 2.6H8z"
        fill="currentColor"
        fillOpacity={0.28}
        stroke="none"
      />
    </>
  ),
  chevron: () => <path d="m4.5 6.3 3.5 3.5 3.5-3.5" />,
  "chevron-up": () => <path d="m4.5 9.7 3.5-3.5 3.5 3.5" />,
  close: () => <path d="m4 4 8 8M12 4l-8 8" />,
  component: () => (
    <path d="M8 1.6 10.1 3.7 8 5.8 5.9 3.7zM8 10.2l2.1 2.1L8 14.4l-2.1-2.1zM3.7 5.9 5.8 8l-2.1 2.1L1.6 8zM12.3 5.9 14.4 8l-2.1 2.1L10.2 8z" />
  ),
  dark: () => (
    <path d="M13.2 9.7A5.6 5.6 0 0 1 6.3 2.8a5.6 5.6 0 1 0 6.9 6.9z" />
  ),
  desktop: () => (
    <>
      <rect x="1.8" y="2.4" width="12.4" height="8.6" rx="1.5" />
      <path d="M5.6 13.8h4.8M8 11v2.8" />
    </>
  ),
  document: () => (
    <>
      <path d="M4 1.9h5l3.1 3.1v8c0 .6-.5 1.1-1.1 1.1H4c-.6 0-1.1-.5-1.1-1.1V3c0-.6.5-1.1 1.1-1.1z" />
      <path d="M9 1.9V5h3.1" />
    </>
  ),
  fit: () => (
    <>
      <path d="M2.4 5.6V3.4c0-.6.4-1 1-1h2.2M10.4 2.4h2.2c.6 0 1 .4 1 1v2.2M13.6 10.4v2.2c0 .6-.4 1-1 1h-2.2M5.6 13.6H3.4c-.6 0-1-.4-1-1v-2.2" />
      <rect x="5.4" y="5.4" width="5.2" height="5.2" rx="1" />
    </>
  ),
  "folder-branch": () => (
    <>
      <circle cx="4.5" cy="3.6" r="1.6" />
      <circle cx="4.5" cy="12.4" r="1.6" />
      <circle cx="11.5" cy="5.4" r="1.6" />
      <path d="M4.5 5.2v5.6M11.5 7c0 2.6-2.4 3.3-5.6 4" />
    </>
  ),
  grip: () => <path d="M6.2 4.6 2.8 8l3.4 3.4M9.8 4.6 13.2 8l-3.4 3.4" />,
  highlight: () => (
    <>
      <path d="M5.3 2H2v3.3M10.7 2H14v3.3M2 10.7V14h3.3M14 10.7V14h-3.3" />
      <rect x="4.7" y="4.7" width="6.6" height="6.6" rx="0.8" />
    </>
  ),
  inspect: () => <path d="M3.2 2.4 13 7.3l-4.3 1.3-1.9 4.3z" />,
  layers: () => (
    <>
      <path d="M8 2 14 5.2 8 8.4 2 5.2z" />
      <path d="m2 8.2 6 3.2 6-3.2M2 11 8 14.2 14 11" />
    </>
  ),
  light: () => (
    <>
      <circle cx="8" cy="8" r="2.8" />
      <path d="M8 1.6v1.5M8 12.9v1.5M1.6 8h1.5M12.9 8h1.5M3.5 3.5l1 1M11.5 11.5l1 1M3.5 12.5l1-1M11.5 4.5l1-1" />
    </>
  ),
  minus: () => <path d="M3.5 8h9" />,
  mobile: () => (
    <>
      <rect x="4.3" y="1.6" width="7.4" height="12.8" rx="1.8" />
      <path d="M7 12.3h2" />
    </>
  ),
  plus: () => <path d="M8 3.5v9M3.5 8h9" />,
  refresh: () => (
    <>
      <path d="M13 8a5 5 0 1 1-1.5-3.6" />
      <path d="M11.8 1.9v2.8H9" />
    </>
  ),
};

/** One Canvas glyph in `currentColor`, hidden from assistive technology. */
export function CanvasGlyph({
  name,
  size = 16,
}: {
  name: CanvasGlyphName;
  size?: number;
}) {
  return (
    <svg
      aria-hidden="true"
      className="cv-glyph"
      fill="none"
      height={size}
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.5}
      viewBox="0 0 16 16"
      width={size}
    >
      {STROKES[name]()}
    </svg>
  );
}
