/** The Mokly mark, shared by the Folio product chrome and account entry. */
export function MoklyMark({ size = 28 }: { size?: number }) {
  return (
    <svg viewBox="0 0 32 32" width={size} height={size} aria-hidden="true">
      <rect
        x="3"
        y="3"
        width="20"
        height="21"
        rx="4"
        fill="currentColor"
        opacity=".3"
      />
      <rect x="9" y="8" width="20" height="21" rx="4" fill="currentColor" />
      <path
        d="M14 15h10M14 20h7"
        stroke="var(--mk-color-surface)"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}
