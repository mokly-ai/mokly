export type InspectorTab = "info" | "components" | "props" | "usage";

const paths: Record<Exclude<InspectorTab, "usage">, string> = {
  info: "M8 11V7m0-3v1M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1Z",
  components: "m8 1 6 3.5v7L8 15l-6-3.5v-7L8 1Zm0 7 6-3.5M8 8v7M8 8 2 4.5",
  props:
    "M3 1v6m0 4v4M8 1v2m0 4v8m5-14v8m0 4v2M1 7h4v4H1V7Zm5-4h4v4H6V3Zm5 6h4v4h-4V9Z",
};

export function InspectorIcon({ tab }: { tab: InspectorTab }) {
  return (
    <svg
      aria-hidden="true"
      width="18"
      height="18"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.25"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {tab === "usage" ? (
        <>
          <path d="m4.8 7.1 6.4-3.2m-6.4 5 6.4 3.2" />
          <circle cx="3" cy="8" r="2" />
          <circle cx="13" cy="3" r="2" />
          <circle cx="13" cy="13" r="2" />
        </>
      ) : (
        <path d={paths[tab]} />
      )}
    </svg>
  );
}

export function CloseInspectorIcon() {
  return (
    <svg
      aria-hidden="true"
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
    >
      <path d="m4 4 8 8M12 4l-8 8" />
    </svg>
  );
}
