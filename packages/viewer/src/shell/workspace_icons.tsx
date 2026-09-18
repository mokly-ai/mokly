/** Consistent stroke icons for the shared workspace controls. */
import { IconSvg } from "./icons.js";

export type WorkspaceIconName =
  | "details"
  | "components"
  | "props"
  | "usage"
  | "highlight"
  | "scheme"
  | "viewport"
  | "close"
  | "caret";
export function WorkspaceIcon({ name }: { name: WorkspaceIconName }) {
  return (
    <IconSvg size={18}>
      {name === "details" ? (
        <>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 11v6m0-10v.1" />
        </>
      ) : name === "components" ? (
        <>
          <path d="m12 3 9 5-9 5-9-5Zm-9 9 9 5 9-5m-18 5 9 5 9-5" />
        </>
      ) : name === "props" ? (
        <>
          <path d="m8 5-6 7 6 7m8-14 6 7-6 7m-3-17-2 20" />
        </>
      ) : name === "usage" ? (
        <>
          <rect x="2" y="8" width="6" height="8" rx="1" />
          <path d="M8 12h6m0-7v14m0-14h3m-3 14h3" />
          <rect x="17" y="2" width="5" height="6" rx="1" />
          <rect x="17" y="16" width="5" height="6" rx="1" />
        </>
      ) : name === "highlight" ? (
        <>
          <path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5" />
          <rect x="7" y="7" width="10" height="10" rx="1" />
        </>
      ) : name === "scheme" ? (
        <path d="M20.5 13a8.5 8.5 0 0 1-9.5-9.5A8.5 8.5 0 1 0 20.5 13Z" />
      ) : name === "viewport" ? (
        <>
          <rect x="6" y="3" width="16" height="12" rx="2" />
          <path d="M12 15v5m-2 0h8" />
          <rect x="2" y="9" width="7" height="12" rx="1" />
        </>
      ) : name === "close" ? (
        <path d="m6 6 12 12M6 18 18 6" />
      ) : (
        <path d="m6 9 6 6 6-6" />
      )}
    </IconSvg>
  );
}
