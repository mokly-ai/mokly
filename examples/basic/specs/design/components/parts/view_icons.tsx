import type { ReactNode } from "react";

export type ViewIconKind =
  | "mobile"
  | "desktop"
  | "both"
  | "light"
  | "dark"
  | "highlight"
  | "chevron"
  | "menu";

const paths: Record<ViewIconKind, ReactNode> = {
  chevron: <path d="m6 9 6 6 6-6" />,
  menu: <path d="M4 6h16M4 12h16M4 18h16" />,
  mobile: (
    <>
      <rect x="7" y="2" width="10" height="20" rx="2" />
      <path d="M10 18h4" />
    </>
  ),
  desktop: (
    <>
      <rect x="2" y="3" width="20" height="14" rx="2" />
      <path d="M8 21h8m-4-4v4" />
    </>
  ),
  both: (
    <>
      <rect x="2" y="2" width="14" height="12" rx="2" />
      <path d="M6 18h6m-3-4v4" />
      <rect x="15" y="9" width="7" height="13" rx="1.5" />
    </>
  ),
  light: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 1v3m0 16v3M1 12h3m16 0h3M4 4l2 2m12 12 2 2M4 20l2-2M18 6l2-2" />
    </>
  ),
  dark: <path d="M21 13a9 9 0 0 1-10-10 9 9 0 1 0 10 10Z" />,
  highlight: (
    <>
      <path d="M8 2H2v6m14-6h6v6M2 16v6h6m14-6v6h-6" />
      <rect x="8" y="8" width="8" height="8" rx="1" />
    </>
  ),
};

export function ViewIcon({
  kind,
  size = 18,
}: {
  kind: ViewIconKind;
  size?: number;
}) {
  return (
    <svg
      aria-hidden="true"
      data-view-icon={kind}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {paths[kind]}
    </svg>
  );
}
