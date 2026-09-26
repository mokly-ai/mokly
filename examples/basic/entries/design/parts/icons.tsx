import type { ReactNode } from "react";

interface IconProps {
  size?: number;
}

function IconSvg({ children, size }: IconProps & { children: ReactNode }) {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      height={size ?? 13}
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      viewBox="0 0 24 24"
      width={size ?? 13}
    >
      {children}
    </svg>
  );
}

/**
 * Mokly's brand mark: two overlapping rounded screens, the front one carrying
 * two short rules. The screens fill with `currentColor`; the `mbk-mark-rules`
 * class paints the rules in the surface color behind the mark.
 */
export function BrandIcon({ size }: IconProps) {
  return (
    <svg
      aria-hidden="true"
      height={size ?? 22}
      viewBox="0 0 32 32"
      width={size ?? 22}
    >
      <rect
        fill="currentColor"
        height={21}
        opacity={0.3}
        rx={4}
        width={20}
        x={3}
        y={3}
      />
      <rect fill="currentColor" height={21} rx={4} width={20} x={9} y={8} />
      <path
        className="mbk-mark-rules"
        d="M14 15h10M14 20h7"
        fill="none"
        strokeLinecap="round"
        strokeWidth={2}
      />
    </svg>
  );
}

/** Disclosure chevron for collapsible groups and the details bar. */
export function ChevronIcon({ size }: IconProps) {
  return (
    <IconSvg size={size ?? 13}>
      <polyline points="9 6 15 12 9 18" />
    </IconSvg>
  );
}

/** Downward chevron marking a control that opens a list of choices. */
export function ChevronDownIcon({ size }: IconProps) {
  return (
    <IconSvg size={size ?? 13}>
      <polyline points="6 9 12 15 18 9" />
    </IconSvg>
  );
}

/** A collapsed folder grouping child screens. */
export function FolderIcon({ size }: IconProps) {
  return (
    <IconSvg size={size ?? 13}>
      <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    </IconSvg>
  );
}

/** An expanded folder revealing its contents. */
export function FolderOpenIcon({ size }: IconProps) {
  return (
    <IconSvg size={size ?? 13}>
      <path d="M6 14l1.5-2.9A2 2 0 0 1 9.24 10H20a2 2 0 0 1 1.94 2.5l-1.54 6a2 2 0 0 1-1.95 1.5H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3.93a2 2 0 0 1 1.66.9l.82 1.2a2 2 0 0 0 1.66.9H18a2 2 0 0 1 2 2v2" />
    </IconSvg>
  );
}

/** A canonical screen: one product state in a browser window. */
export function ScreenIcon({ size }: IconProps) {
  return (
    <IconSvg size={size ?? 13}>
      <rect height={16} rx={2} width={18} x={3} y={4} />
      <path d="M3 9h18" />
    </IconSvg>
  );
}

/**
 * A screen variant: one authored state of a screen, drawn as a screen sitting
 * in front of the screen it belongs to. The screen behind is a partial outline
 * with butt caps so both ends meet the front screen's edge cleanly.
 */
export function VariantIcon({ size }: IconProps) {
  return (
    <IconSvg size={size ?? 13}>
      <path
        d="M6 6V5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2h-2"
        strokeLinecap="butt"
      />
      <rect height={14} rx={2} width={16} x={2} y={6} />
      <path d="M2 10h16" />
    </IconSvg>
  );
}

/** The search affordance at the leading edge of the top bar's search field. */
export function SearchIcon({ size }: IconProps) {
  return (
    <IconSvg size={size ?? 15}>
      <circle cx={11} cy={11} r={7} />
      <path d="M20 20l-3.9-3.9" />
    </IconSvg>
  );
}

/** The copy affordance at the trailing edge of a browser bar's address pill. */
export function CopyIcon({ size }: IconProps) {
  return (
    <IconSvg size={size ?? 13}>
      <rect height={13} rx={2} width={13} x={9} y={9} />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </IconSvg>
  );
}

/** Outward arrows on the browser bar's expand toggle. */
export function ExpandIcon({ size }: IconProps) {
  return (
    <IconSvg size={size ?? 13}>
      <polyline points="15 3 21 3 21 9" />
      <polyline points="9 21 3 21 3 15" />
      <path d="M21 3l-7 7" />
      <path d="M3 21l7-7" />
    </IconSvg>
  );
}

/** A document page, used for related-doc references. */
export function PageIcon({ size }: IconProps) {
  return (
    <IconSvg size={size ?? 13}>
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
      <path d="M14 3v5h5" />
    </IconSvg>
  );
}

/** A use case: connected steps through canonical screens. */
export function FlowIcon({ size }: IconProps) {
  return (
    <IconSvg size={size ?? 13}>
      <rect height={8} rx={2} width={8} x={3} y={3} />
      <path d="M7 11v4a2 2 0 0 0 2 2h4" />
      <rect height={8} rx={2} width={8} x={13} y={13} />
    </IconSvg>
  );
}

/** Appearance left to the system: a disc split between light and dark. */
export function AutoAppearanceIcon({ size }: IconProps) {
  return (
    <IconSvg size={size ?? 13}>
      <circle cx={12} cy={12} r={9} />
      <path d="M12 3a9 9 0 0 0 0 18z" fill="currentColor" strokeWidth={0} />
    </IconSvg>
  );
}

/** Explicit light appearance, shown when the selector holds Light. */
export function LightAppearanceIcon({ size }: IconProps) {
  return (
    <IconSvg size={size ?? 13}>
      <circle cx={12} cy={12} r={4.5} />
      <path d="M12 2v2m0 16v2M2 12h2m16 0h2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </IconSvg>
  );
}

/** Explicit dark appearance, shown when the selector holds Dark. */
export function DarkAppearanceIcon({ size }: IconProps) {
  return (
    <IconSvg size={size ?? 13}>
      <path d="M21 13a9 9 0 0 1-10-10 9 9 0 1 0 10 10z" />
    </IconSvg>
  );
}

/** An authored tag, used for the tag chips and the tag search term. */
export function TagIcon({ size }: IconProps) {
  return (
    <IconSvg size={size ?? 13}>
      <path d="M20.6 13.4l-7.2 7.2a2 2 0 0 1-2.8 0l-7.4-7.4A2 2 0 0 1 2.6 12V5a2 2 0 0 1 2-2h7a2 2 0 0 1 1.4.6l7.6 7.6a2 2 0 0 1 0 2.8z" />
      <path d="M7.6 7.6h.01" />
    </IconSvg>
  );
}
