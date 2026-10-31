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
