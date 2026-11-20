import type { ReactNode } from "react";

/**
 * The page's main landmark and the skip link to it, which the viewer and its
 * wait both draw. While an overlay owns the landmark, the same element stays,
 * hidden, so the stage beneath stays mounted.
 */
export function ViewerMain({
  beneath,
  children,
}: {
  beneath: boolean;
  children: ReactNode;
}) {
  return (
    <>
      {!beneath && (
        <a className="skip-link" href="#main">
          Skip to content
        </a>
      )}
      <div
        id={beneath ? undefined : "main"}
        role={beneath ? undefined : "main"}
        className={beneath ? "fo-viewer-backdrop" : "fo-viewer-main"}
        aria-hidden={beneath || undefined}
      >
        {children}
      </div>
    </>
  );
}

/** Keep the stage mounted while an overlay owns its landmark and heading. */
export function ViewerBody({
  beneath,
  heading,
  stage,
}: {
  beneath: boolean;
  heading: string;
  stage: ReactNode;
}) {
  return (
    <ViewerMain beneath={beneath}>
      {!beneath && <h1 className="fo-sr-only">{heading}</h1>}
      {stage}
    </ViewerMain>
  );
}
