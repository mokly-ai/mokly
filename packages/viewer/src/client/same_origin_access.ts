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

export function sameFrameResource(documentUrl: string, expected: URL): boolean {
  const actual = new URL(documentUrl);
  return (
    actual.origin === expected.origin &&
    !actual.username &&
    !actual.password &&
    normalizedHtmlPath(actual.pathname) ===
      normalizedHtmlPath(expected.pathname) &&
    actual.search === expected.search
  );
}

export function assignedFrameResource(
  frame: HTMLIFrameElement,
  expected: URL,
): boolean {
  const source = frame.getAttribute("src");
  if (!source) return false;
  try {
    return sameFrameResource(
      new URL(source, frame.ownerDocument.baseURI).href,
      expected,
    );
  } catch {
    return false;
  }
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

function normalizedHtmlPath(pathname: string): string {
  return pathname.endsWith(".html") ? pathname.slice(0, -5) : pathname;
}
