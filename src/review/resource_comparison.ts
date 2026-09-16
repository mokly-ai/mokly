import { parse } from "parse5";

import { isStylesheetPath } from "@mokly/viewer/data";

import type { ComponentMaterialReader } from "./component_resources.js";
import type { CssDocumentPair } from "./css/document.js";
import {
  CssResourceAnalysis,
  type ChangedResource,
  type ResourceEvidence,
} from "./css/resource_analysis.js";

/** A view side after the comparison's paired normalization. */
export interface ResourceDocument {
  path: string;
  html: string;
}

/** Shared resource discovery and rule attribution for both result versions. */
export class ResourceComparison {
  constructor(
    readonly before: ComponentMaterialReader,
    readonly after: ComponentMaterialReader,
    readonly changed: ReadonlySet<string>,
    readonly prefix: string,
    readonly css: CssResourceAnalysis = new CssResourceAnalysis(),
  ) {
    before.pairWith(after, "before");
    after.pairWith(before, "after");
  }

  async compare(
    before: ResourceDocument | undefined,
    after: ResourceDocument | undefined,
    excluded: (path: string) => boolean = () => false,
    matching: { before?: string | undefined; after?: string | undefined } = {
      before: before?.html,
      after: after?.html,
    },
  ): Promise<ResourceEvidence> {
    const bases = before
      ? await this.before.resources(before.path, before.html, excluded)
      : new Set<string>();
    const heads = after
      ? await this.after.resources(after.path, after.html, excluded)
      : new Set<string>();
    const resources: ChangedResource[] = [];
    const changedCss = [...new Set([...bases, ...heads])].filter(
      (route) =>
        !excluded(route) &&
        isStylesheetPath(route) &&
        this.changed.has(this.prefix ? `${this.prefix}/${route}` : route),
    );
    const baseCss = await this.before.optionalTexts(changedCss);
    const headCss = await this.after.optionalTexts(changedCss);
    const documents: CssDocumentPair[] = changedCss.length
      ? [
          {
            ...(matching.before === undefined
              ? {}
              : { before: parse(matching.before) }),
            ...(matching.after === undefined
              ? {}
              : { after: parse(matching.after) }),
          },
        ]
      : [];
    for (const route of new Set([...bases, ...heads])) {
      if (excluded(route)) continue;
      const path = this.prefix ? `${this.prefix}/${route}` : route;
      if (this.changed.has(path))
        resources.push({
          path,
          ...(baseCss.get(route) === undefined
            ? {}
            : { before: baseCss.get(route)! }),
          ...(headCss.get(route) === undefined
            ? {}
            : { after: headCss.get(route)! }),
        });
      if (changedCss.length && /\.html?$/i.test(route)) {
        const base = bases.has(route)
          ? await this.before.resourceText(route)
          : undefined;
        const head = heads.has(route)
          ? await this.after.resourceText(route)
          : undefined;
        documents.push({
          ...(base === undefined ? {} : { before: parse(base) }),
          ...(head === undefined ? {} : { after: parse(head) }),
        });
      }
    }
    return this.css.analyze(resources, documents);
  }
}
