/** Authentication and identity transfer for immediate same-origin documents. */

const authenticatedDocument: unique symbol = Symbol("authenticated-document");
const authenticatedDocuments = new WeakSet<Document>();
const mountedResources = new WeakMap<HTMLIFrameElement, string>();

/** A document whose frame and assigned resource identity were authenticated. */
export type AuthenticatedDocument = Document & {
  readonly defaultView: Window;
  readonly [authenticatedDocument]: true;
};

/** Mount-scoped document transfer and assigned-resource authentication. */
export interface MountAuthentication {
  /** Last adapter assignment; absence identifies the first hydration mount. */
  readonly previousResource: string | undefined;
  /** The authenticated starting document eligible for ownership transfer. */
  readonly transferredDocument: AuthenticatedDocument | undefined;
  /** Authenticate a candidate without promoting an excluded starting object. */
  authenticateAssignedDocument(
    doc: Document | null | undefined,
    expected: URL,
  ): AuthenticatedDocument | undefined;
}

/** Establish weak frame provenance and authentication rules for one mount. */
export function createMountAuthentication(
  frame: HTMLIFrameElement,
  startingDocument: Document | null | undefined,
  expected: URL,
): MountAuthentication {
  const previousResource = mountedResources.get(frame);
  mountedResources.set(frame, expected.href);
  const transferredDocument = transferAuthenticatedDocument(
    frame,
    startingDocument,
  );
  const excludedDocument =
    previousResource === undefined || transferredDocument
      ? undefined
      : startingDocument;
  return {
    previousResource,
    transferredDocument,
    authenticateAssignedDocument: (doc, expected) =>
      doc === excludedDocument
        ? undefined
        : authenticateAssignedDocument(frame, doc, expected),
  };
}

/** Record one immediate candidate after its assigned resource matches. */
function authenticateAssignedDocument(
  frame: HTMLIFrameElement,
  doc: Document | null | undefined,
  expected: URL,
): AuthenticatedDocument | undefined {
  if (
    !doc ||
    doc.defaultView?.frameElement !== frame ||
    !sameFrameResource(doc.URL, expected)
  )
    return undefined;
  authenticatedDocuments.add(doc);
  return doc as AuthenticatedDocument;
}

/** Transfer a recorded document only while it remains in its owning frame. */
function transferAuthenticatedDocument(
  frame: HTMLIFrameElement,
  doc: Document | null | undefined,
): AuthenticatedDocument | undefined {
  return doc &&
    doc.defaultView?.frameElement === frame &&
    authenticatedDocuments.has(doc)
    ? (doc as AuthenticatedDocument)
    : undefined;
}

/** Compare a loaded document URL with the assigned resource, excluding its hash. */
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

/** Check whether the frame's assigned `src` still names the expected resource. */
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

/** Canonicalize the optional final `.html` suffix used by static hosts. */
export function normalizedHtmlPath(pathname: string): string {
  return pathname.endsWith(".html") ? pathname.slice(0, -5) : pathname;
}
