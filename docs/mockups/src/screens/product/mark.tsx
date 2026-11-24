/**
 * The Mokly mark, shared by the product chrome and account entry: an outline
 * frame in the current colour behind a signal front layer that carries two
 * short rules. A surface halo, painted under the front layer's fill, parts
 * the layer from the frame.
 */
export function MoklyMark({ size = 28 }: { size?: number }) {
  return (
    <svg viewBox="0 0 32 32" width={size} height={size} aria-hidden="true">
      <rect
        x="3.6"
        y="3.6"
        width="18.8"
        height="19.8"
        rx="4.6"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <rect
        x="9"
        y="8"
        width="20"
        height="21"
        rx="4.8"
        fill="var(--mk-color-signal)"
        paintOrder="stroke"
        stroke="var(--mk-color-surface)"
        strokeWidth="1.6"
      />
      <path
        d="M14 15h10M14 20h7"
        fill="none"
        stroke="var(--mk-color-on-signal)"
        strokeWidth="2.1"
        strokeLinecap="round"
      />
    </svg>
  );
}
