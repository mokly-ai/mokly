import { origin } from "../inspector/values.js";

import type { FrameMount } from "./frame_adapter.js";
import { FrameError } from "./frame_error.js";

const mounts = new WeakMap<HTMLIFrameElement, () => void>();

/** One owner per immediate frame, including replacements across adapter kinds. */
export function ownFrame(
  frame: HTMLIFrameElement,
  dispose: () => void,
): () => void {
  mounts.get(frame)?.();
  mounts.set(frame, dispose);
  return () => {
    if (mounts.get(frame) === dispose) mounts.delete(frame);
  };
}

export function frameUrl(
  frame: HTMLIFrameElement,
  view: FrameMount,
  expectedOrigin: string,
): URL {
  const url = new URL(view.url.href);
  if (
    !origin(expectedOrigin) ||
    url.origin !== expectedOrigin ||
    url.username ||
    url.password ||
    frame.hasAttribute("srcdoc")
  )
    throw new FrameError("origin");
  let pathname: string, fragment: string;
  try {
    pathname = decodeURIComponent(url.pathname);
    fragment = decodeURIComponent(url.hash.slice(1));
  } catch {
    throw new FrameError("origin");
  }
  if (
    !pathname.startsWith("/static/") ||
    !/\.html?$/.test(pathname) ||
    pathname
      .split("/")
      .slice(2)
      .some(
        (part) =>
          !part ||
          part === "." ||
          part === ".." ||
          /[\\?#]/.test(part) ||
          [...part].some((character) => character.charCodeAt(0) < 32),
      ) ||
    /%2f|%5c/i.test(url.pathname) ||
    (fragment && !/^[A-Za-z][A-Za-z0-9_:.-]{0,255}$/.test(fragment)) ||
    url.search.length > 2048
  )
    throw new FrameError("origin");
  return url;
}

/** Cancel an owned built-in mount even before its promise resolves. */
export function cancelFrameMount(frame: HTMLIFrameElement): void {
  mounts.get(frame)?.();
}
