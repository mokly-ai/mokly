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
