const documentOrigin = "https://mokly-build.invalid";

function localDocumentReferences(html) {
  const references = [];
  for (const match of html.matchAll(
    /\b(?:href|src)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/gi,
  )) {
    const value = (match[1] ?? match[2] ?? match[3] ?? "").trim();
    if (value.length === 0 || value.startsWith("#")) continue;
    const url = new URL(value, documentOrigin + "/");
    if (url.origin === documentOrigin) {
      references.push({ path: url.pathname, value });
    }
  }
  return references;
}

/** Return every same-origin href/src path written into an HTML document. */
export function localDocumentPaths(html) {
  return localDocumentReferences(html).map((reference) => reference.path);
}

/** Require every local document reference to be rooted at the public origin. */
export function assertRootDocumentPaths(html) {
  const references = localDocumentReferences(html);
  for (const reference of references) {
    if (!reference.value.startsWith("/") || reference.value.startsWith("//")) {
      throw new Error(
        `the web build asset is not root-relative: ${reference.value}`,
      );
    }
  }
  return references.map((reference) => reference.path);
}
