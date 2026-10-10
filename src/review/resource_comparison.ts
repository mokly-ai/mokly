import type { ResourceEvidence } from "@mokly/viewer/data";
import { isStylesheetPath } from "@mokly/viewer/data";

import { parseHtml } from "../diagnostics/html_parse.js";

import type { ComponentMaterialReader } from "./component_resources.js";
import type { CssDocument } from "./css/document.js";
import {
  CssResourceAnalysis,
  type ChangedResource,
  type ResourceMatchingPair,
} from "./css/resource_analysis.js";
import { documentStylesheetScope } from "./css/resource_scope.js";
import {
  decideReferencedResource,
  type ResourceDecision,
} from "./deleted_resource.js";
import type { MoveResources } from "./moves/resources.js";

/** A view side after the comparison's paired normalization. */
export interface ResourceDocument {
  path: string;
  html: string;
  references?: readonly string[];
  insertedStylesheets?: readonly string[];
}

/** Shared resource discovery and rule attribution for both result versions. */
export class ResourceComparison {
  constructor(
    readonly before: ComponentMaterialReader,
    readonly after: ComponentMaterialReader,
    readonly changed: ReadonlySet<string>,
    readonly prefix: string,
    readonly css: CssResourceAnalysis = new CssResourceAnalysis(),
    readonly identities?: MoveResources,
    readonly componentAware = false,
  ) {
    before.pairWith(after, "before");
    after.pairWith(before, "after");
    after.allowMissingResources(() => true);
    if (componentAware) {
      before.useOriginalDocuments();
      after.useOriginalDocuments();
    }
  }

  async compare(
    before: ResourceDocument | undefined,
    after: ResourceDocument | undefined,
    excluded?: (path: string) => boolean,
    matching: {
      before?: string | CssDocument | undefined;
      after?: string | CssDocument | undefined;
    } = {
      before: before?.html,
      after: after?.html,
    },
    cssDocuments?: () => readonly ResourceMatchingPair[],
  ): Promise<ResourceEvidence> {
    const bases = before
      ? await this.before.resources(before.path, before.html, excluded, {
          references: before.references,
          insertedStylesheets: before.insertedStylesheets,
        })
      : new Set<string>();
    const heads = after
      ? await this.after.resources(after.path, after.html, excluded, {
          references: after.references,
          insertedStylesheets: after.insertedStylesheets,
        })
      : new Set<string>();
    const resources: ChangedResource[] = [];
    const equal = this.identities?.equivalent(bases, heads);
    const discovered = [...new Set([...bases, ...heads])].filter(
      (route) => !equal?.has(route),
    );
    const changedRoutes = discovered.filter(
      (route) => !excluded?.(route) && this.changed.has(this.path(route)),
    );
    const current = new Map<string, ResourceDecision>();
    for (const route of discovered)
      if (heads.has(route))
        current.set(
          route,
          await decideReferencedResource(route, this.before, this.after),
        );
    const baseChanged = await this.before.optionalTexts(changedRoutes);
    const headChanged = await this.after.optionalTexts(changedRoutes);
    const changedCss = discovered.filter(
      (route) =>
        !excluded?.(route) &&
        isStylesheetPath(route) &&
        this.changed.has(this.path(route)),
    );
    const documents: ResourceMatchingPair[] = changedCss.length
      ? [
          ...(cssDocuments?.() ?? [
            {
              ...(matching.before === undefined
                ? {}
                : {
                    before:
                      typeof matching.before === "string"
                        ? parseHtml("stylesheetMatching", matching.before, {
                            sourceCodeLocationInfo: true,
                          })
                        : matching.before,
                  }),
              ...(matching.after === undefined
                ? {}
                : {
                    after:
                      typeof matching.after === "string"
                        ? parseHtml("stylesheetMatching", matching.after, {
                            sourceCodeLocationInfo: true,
                          })
                        : matching.after,
                  }),
            },
          ]),
        ]
      : [];
    if (changedCss.length) {
      const scoped = await this.stylesheetScope(before, after);
      for (const pair of documents) pair.paths = scoped;
    }
    for (const route of discovered) {
      if (excluded?.(route)) continue;
      const path = this.path(route);
      const html = /\.html?$/i.test(route);
      const baseDocument =
        html && bases.has(route)
          ? await this.before.resourceText(route)
          : undefined;
      const headDocument =
        html &&
        heads.has(route) &&
        current.get(route)?.kind !== "verified-deletion"
          ? await this.after.resourceText(route)
          : undefined;
      if (this.changed.has(path) && (!html || baseDocument !== headDocument))
        resources.push({
          path,
          ...(baseChanged.get(route) === undefined
            ? {}
            : { before: baseChanged.get(route)! }),
          ...(headChanged.get(route) === undefined
            ? {}
            : { after: headChanged.get(route)! }),
        });
      if (changedCss.length && html) {
        documents.push({
          ...(baseDocument === undefined
            ? {}
            : { before: await this.before.resourceDocument(route) }),
          ...(headDocument === undefined
            ? {}
            : { after: await this.after.resourceDocument(route) }),
          paths: await this.stylesheetScope(
            baseDocument === undefined
              ? undefined
              : { path: route, html: baseDocument },
            headDocument === undefined
              ? undefined
              : { path: route, html: headDocument },
          ),
        });
      }
    }
    return this.css.analyze(resources, documents);
  }

  private async stylesheetScope(
    before?: ResourceDocument,
    after?: ResourceDocument,
  ): Promise<ReadonlySet<string>> {
    return documentStylesheetScope(
      [
        ...(before ? [{ reader: this.before, ...before }] : []),
        ...(after ? [{ reader: this.after, ...after }] : []),
      ],
      (route) => this.path(route),
    );
  }

  private path(route: string): string {
    return this.prefix ? `${this.prefix}/${route}` : route;
  }
}
