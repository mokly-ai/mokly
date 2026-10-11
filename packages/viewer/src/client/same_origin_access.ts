import {
  currentDocumentPath,
  VIEWER_DIRECTORY,
} from "../catalogue/delivery_paths.js";

import { sameFrameResource } from "./same_origin_identity.js";

/** Preserve the complete assigned URL when present; route-only callers have no query. */
export function localResourceUrl(
  frame: HTMLIFrameElement,
  path: string | URL,
): URL {
  if (typeof path !== "string") return path;
  return new URL(
    path.startsWith(`/${VIEWER_DIRECTORY}/components/renders/`)
      ? path
      : `/${currentDocumentPath(path)}`,
    frame.ownerDocument.baseURI,
  );
}

/** Private local transport. Cross-origin mounts never enter this module. */
export interface LocalFrameAccess {
  document(): Document | null;
  pathname(): string | undefined;
  replace(url: URL): void;
}

export function localFrameAccess(frame: HTMLIFrameElement): LocalFrameAccess {
  return {
    document: () => frame.contentDocument,
    pathname: () => frame.contentWindow?.location.pathname,
    replace: (url) => frame.contentWindow?.location.replace(url.href),
  };
}

export function recordedFrameResource(
  frame: HTMLIFrameElement,
  documentUrl: string,
): boolean {
  try {
    const expected = new URL(documentUrl);
    return [frame.dataset["fragmentLight"], frame.dataset["fragmentDark"]].some(
      (source) =>
        source !== undefined &&
        sameFrameResource(
          new URL(source, frame.ownerDocument.baseURI).href,
          expected,
        ),
    );
  } catch {
    return false;
  }
}
