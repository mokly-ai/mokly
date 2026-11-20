/** Font-independent decorative marks inside the registered illustration. */
export function Motif({ kind }: { kind: "code" | "grid" | "branch" }) {
  return (
    <svg
      viewBox="0 0 32 32"
      width="32"
      height="32"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {kind === "code" && <path d="m11 8-8 8 8 8m10-16 8 8-8 8M18 5l-4 22" />}
      {kind === "grid" && (
        <>
          <rect x="3" y="3" width="10" height="10" rx="2" />
          <rect x="19" y="3" width="10" height="10" rx="2" />
          <rect x="3" y="19" width="10" height="10" rx="2" />
          <rect x="19" y="19" width="10" height="10" rx="2" />
        </>
      )}
      {kind === "branch" && (
        <>
          <circle cx="8" cy="6" r="3" />
          <circle cx="8" cy="26" r="3" />
          <circle cx="24" cy="6" r="3" />
          <path d="M8 9v14M24 9v2a9 9 0 0 1-9 9H8" />
        </>
      )}
    </svg>
  );
}
