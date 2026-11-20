/**
 * Line glyphs for the site screens. They mirror the catalogue shell's
 * own icon set so the depicted product chrome reads as the same tool, the
 * header's menu controls draw from the same set, and they inherit color so
 * the site tokens decide every stroke.
 */

import type { ReactNode } from "react";

function Glyph({ children, size }: { children: ReactNode; size: number }) {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      height={size}
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      viewBox="0 0 24 24"
      width={size}
    >
      {children}
    </svg>
  );
}

/** Overlapping mobile and desktop screens: the Mokly mark in the top bar. */
export function MarkGlyph({ size = 15 }: { size?: number }) {
  return (
    <Glyph size={size}>
      <path
        d="M6.5 5.5V5a2 2 0 0 1 2-2H20a2 2 0 0 1 2 2v10.5a2 2 0 0 1-2 2h-8"
        strokeLinecap="butt"
      />
      <rect height={13} rx={1.75} width={8.5} x={1.5} y={7} />
    </Glyph>
  );
}

/** Disclosure chevron for a collapsible navigation section. */
export function ChevronGlyph({ size = 12 }: { size?: number }) {
  return (
    <Glyph size={size}>
      <polyline points="9 6 15 12 9 18" />
    </Glyph>
  );
}

/** A folder that groups child entries. */
export function FolderGlyph({ size = 13 }: { size?: number }) {
  return (
    <Glyph size={size}>
      <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    </Glyph>
  );
}

/** One screen: a product state in a browser window. */
export function ScreenGlyph({ size = 13 }: { size?: number }) {
  return (
    <Glyph size={size}>
      <rect height={16} rx={2} width={18} x={3} y={4} />
      <path d="M3 9h18" />
    </Glyph>
  );
}

/** One component: a shared building block reused across screens. */
export function ComponentGlyph({ size = 13 }: { size?: number }) {
  return (
    <Glyph size={size}>
      <path d="m8 1 6 3.5v7L8 15l-6-3.5v-7L8 1Zm0 7 6-3.5M8 8v7M8 8 2 4.5" />
    </Glyph>
  );
}

/** A use-case flow: connected steps through canonical screens. */
export function FlowGlyph({ size = 13 }: { size?: number }) {
  return (
    <Glyph size={size}>
      <rect height={6} rx={1.5} width={7} x={2} y={4} />
      <rect height={6} rx={1.5} width={7} x={15} y={14} />
      <path d="M9 7h5a2 2 0 0 1 2 2v5" />
    </Glyph>
  );
}

/** A document page in the catalogue. */
export function PageGlyph({ size = 13 }: { size?: number }) {
  return (
    <Glyph size={size}>
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
      <path d="M14 3v5h5" />
    </Glyph>
  );
}

/** The search affordance at the leading edge of a search field. */
export function SearchGlyph({ size = 14 }: { size?: number }) {
  return (
    <Glyph size={size}>
      <circle cx={11} cy={11} r={7} />
      <path d="M20 20l-3.9-3.9" />
    </Glyph>
  );
}

/** The send affordance on the agent rail's message field. */
export function SendGlyph({ size = 12 }: { size?: number }) {
  return (
    <Glyph size={size}>
      <path d="M12 20V5" />
      <polyline points="6 11 12 5 18 11" />
    </Glyph>
  );
}

/** The tag filter at the trailing edge of the catalogue search field. */
export function TagGlyph({ size = 13 }: { size?: number }) {
  return (
    <Glyph size={size}>
      <path d="M3 12V5a2 2 0 0 1 2-2h7l9 9-9 9z" />
      <circle cx={7.5} cy={7.5} r={1.2} />
    </Glyph>
  );
}

/** Three rules: the mobile header's menu control. */
export function MenuGlyph({ size = 20 }: { size?: number }) {
  return (
    <Glyph size={size}>
      <path d="M4 7h16M4 12h16M4 17h16" />
    </Glyph>
  );
}

/** A cross: the control that closes the mobile menu. */
export function CloseGlyph({ size = 20 }: { size?: number }) {
  return (
    <Glyph size={size}>
      <path d="M6 6l12 12M18 6L6 18" />
    </Glyph>
  );
}
