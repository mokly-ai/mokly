import { providerNormalizedHtmlPath } from "@mokly/viewer/data";

const HTML_PATH_ATTRIBUTE =
  /(href|src|data-fragment-light|data-fragment-dark)="([^"]+)"/g;

/** Apply the provider's extensionless form only to shared-helper-approved paths. */
export function normalizeProviderHtmlAttributes(html) {
  return html.replace(HTML_PATH_ATTRIBUTE, (matched, attribute, value) => {
    const suffixAt = [value.indexOf("?"), value.indexOf("#")]
      .filter((index) => index >= 0)
      .sort((left, right) => left - right)[0];
    const pathname = suffixAt === undefined ? value : value.slice(0, suffixAt);
    const normalized = providerNormalizedHtmlPath(pathname);
    if (normalized === undefined) return matched;
    const suffix = suffixAt === undefined ? "" : value.slice(suffixAt);
    return `${attribute}="${normalized}${suffix}"`;
  });
}
