// Shared Mokly shell glyphs: the disclosure chevron, the closed / open
// folder icons for collapsible collections, the screen / page / use-case leaf
// icons, the top bar's brand, search and tag controls, and the device chrome's
// copy and expand / collapse controls. All icons are stroke-based on a 24-unit
// viewBox and inherit `currentColor`. Authored collection groups swap closed
// and open folder icons; top-level catalogue sections and the details inspector
// use the chevron.

import type { ReactNode } from "react";

export function IconSvg(props: { children: ReactNode; size: number }) {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      height={props.size}
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      viewBox="0 0 24 24"
      width={props.size}
    >
      {props.children}
    </svg>
  );
}

/** Overlapping mobile and desktop screens in Mokly's brand mark. */
export function BrandIcon(props: { size?: number }) {
  return (
    <IconSvg size={props.size ?? 17}>
      <path
        d="M6.5 5.5V5a2 2 0 0 1 2-2H20a2 2 0 0 1 2 2v10.5a2 2 0 0 1-2 2h-8"
        strokeLinecap="butt"
      />
      <rect height={13} rx={1.75} width={8.5} x={1.5} y={7} />
    </IconSvg>
  );
}

/** Disclosure chevron for collapsible groups and the details bar. */
export function ChevronIcon(props: { size?: number }) {
  return (
    <IconSvg size={props.size ?? 13}>
      <polyline points="9 6 15 12 9 18" />
    </IconSvg>
  );
}

/** A collapsed collection: a closed folder that groups child screens/pages. */
export function FolderIcon(props: { size?: number }) {
  return (
    <IconSvg size={props.size ?? 13}>
      <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    </IconSvg>
  );
}

/** An expanded collection: an open folder revealing its contents. */
export function FolderOpenIcon(props: { size?: number }) {
  return (
    <IconSvg size={props.size ?? 13}>
      <path d="M6 14l1.5-2.9A2 2 0 0 1 9.24 10H20a2 2 0 0 1 1.94 2.5l-1.54 6a2 2 0 0 1-1.95 1.5H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3.93a2 2 0 0 1 1.66.9l.82 1.2a2 2 0 0 0 1.66.9H18a2 2 0 0 1 2 2v2" />
    </IconSvg>
  );
}

/** A structured screen: one product state in a browser window. */
export function ScreenIcon(props: { size?: number }) {
  return (
    <IconSvg size={props.size ?? 13}>
      <rect height={16} rx={2} width={18} x={3} y={4} />
      <path d="M3 9h18" />
    </IconSvg>
  );
}

/** The search affordance at the leading edge of the top bar's search field. */
export function SearchIcon(props: { size?: number }) {
  return (
    <IconSvg size={props.size ?? 15}>
      <circle cx={11} cy={11} r={7} />
      <path d="M20 20l-3.9-3.9" />
    </IconSvg>
  );
}

/** The copy affordance at the trailing edge of a browser bar's address pill. */
export function CopyIcon(props: { size?: number }) {
  return (
    <IconSvg size={props.size ?? 13}>
      <rect height={13} rx={2} width={13} x={9} y={9} />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </IconSvg>
  );
}

/** Outward arrows on the browser bar's toggle while the frame is inline. */
export function ExpandIcon(props: { size?: number }) {
  return (
    <IconSvg size={props.size ?? 13}>
      <polyline points="15 3 21 3 21 9" />
      <polyline points="9 21 3 21 3 15" />
      <path d="M21 3l-7 7" />
      <path d="M3 21l7-7" />
    </IconSvg>
  );
}

/** Inward arrows on the browser bar's toggle while the frame is expanded. */
export function CollapseIcon(props: { size?: number }) {
  return (
    <IconSvg size={props.size ?? 13}>
      <polyline points="4 14 10 14 10 20" />
      <polyline points="20 10 14 10 14 4" />
      <path d="M14 10l7-7" />
      <path d="M3 21l7-7" />
    </IconSvg>
  );
}

/** A complete catalogue page: a document that may hold several states. */
export function PageIcon(props: { size?: number }) {
  return (
    <IconSvg size={props.size ?? 13}>
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
      <path d="M14 3v5h5" />
    </IconSvg>
  );
}

/** A declared classification tag, drawn on the details inspector's tag chips. */
export function TagIcon(props: { size?: number }) {
  return (
    <IconSvg size={props.size ?? 13}>
      <path d="M20.6 13.4l-7.2 7.2a2 2 0 0 1-2.8 0l-7.4-7.4A2 2 0 0 1 2.6 12V5a2 2 0 0 1 2-2h7a2 2 0 0 1 1.4.6l7.6 7.6a2 2 0 0 1 0 2.8z" />
      <path d="M7.6 7.6h.01" />
    </IconSvg>
  );
}

/** A use case: connected steps through canonical screens. */
export function FlowIcon(props: { size?: number }) {
  return (
    <IconSvg size={props.size ?? 13}>
      <rect height={8} rx={2} width={8} x={3} y={3} />
      <path d="M7 11v4a2 2 0 0 0 2 2h4" />
      <rect height={8} rx={2} width={8} x={13} y={13} />
    </IconSvg>
  );
}
