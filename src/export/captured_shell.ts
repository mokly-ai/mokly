/** Static bootstrap conversion for shell documents captured from live Serve. */

import { isDeepStrictEqual } from "node:util";

import { parse, type DefaultTreeAdapterMap } from "parse5";

import type { CatalogueReadModel } from "@mokly/viewer";
import {
  externalShellBootstrap,
  readShellBootstrap,
  serializeShellBootstrap,
} from "@mokly/viewer/runtime";

import { exportError } from "./error.js";

type HtmlNode = DefaultTreeAdapterMap["node"];
type HtmlElement = DefaultTreeAdapterMap["element"];

/** Replace one captured live read model with the matching shared static reference. */
export function externalizeCapturedShell(
  name: string,
  html: string,
  catalogue: CatalogueReadModel,
): string {
  const document = parse(html, { sourceCodeLocationInfo: true });
  const scripts = matchingScripts(document);
  if (scripts.length !== 1)
    throw exportError(`Invalid captured shell bootstrap: ${name}`);
  const script = scripts[0]!;
  const start = script.sourceCodeLocation?.startTag?.endOffset;
  const end = script.sourceCodeLocation?.endTag?.startOffset;
  if (start === undefined || end === undefined || start > end)
    throw exportError(`Invalid captured shell bootstrap: ${name}`);
  let bootstrap;
  try {
    bootstrap = readShellBootstrap(JSON.parse(html.slice(start, end)));
  } catch (cause) {
    throw exportError(`Invalid captured shell bootstrap: ${name}`, cause);
  }
  if (
    bootstrap.context.comparisons !== (catalogue.comparisonUrl !== null) ||
    !sameRenderedCatalogue(bootstrap.catalogue, catalogue)
  )
    throw exportError(
      `Captured shell catalogue does not match the published model: ${name}`,
    );
  const external = externalShellBootstrap({ ...bootstrap, catalogue });
  return `${html.slice(0, start)}${serializeShellBootstrap(external)}${html.slice(end)}`;
}

function sameRenderedCatalogue(
  captured: CatalogueReadModel,
  published: CatalogueReadModel,
): boolean {
  if ((captured.comparisonUrl === null) !== (published.comparisonUrl === null))
    return false;
  const normalize = (model: CatalogueReadModel): CatalogueReadModel => ({
    ...model,
    deploymentId: "0".repeat(64),
    revision: { content: 0, evidence: 0 },
    comparisonUrl: null,
  });
  return isDeepStrictEqual(normalize(captured), normalize(published));
}

function matchingScripts(node: HtmlNode): HtmlElement[] {
  const current =
    "tagName" in node &&
    node.tagName === "script" &&
    node.attrs.some(({ name }) => name === "data-mokly-shell-bootstrap")
      ? [node]
      : [];
  return "childNodes" in node
    ? [
        ...current,
        ...node.childNodes.flatMap((child) => matchingScripts(child)),
      ]
    : current;
}
