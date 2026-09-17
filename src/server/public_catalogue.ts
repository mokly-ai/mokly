import path from "node:path";

import type { ComponentViewRecord } from "@mokly/viewer";
import { counter, generatedViews } from "@mokly/viewer/data";

import type { CompiledDocument } from "../build/document_compiler.js";
import { projectCatalogue } from "../catalogue/projection.js";
import type { CatalogueProjectionInput } from "../catalogue/projection_input.js";
import {
  identifyLiveCatalogue,
  serializeCatalogue,
} from "../catalogue/serialization.js";
import { toPosixPath } from "../config/paths.js";
import type { ResolvedConfig } from "../config/types.js";

type AcceptedCatalogue = Omit<
  CatalogueProjectionInput,
  "configPath" | "revision" | "usage"
>;

/** HTTP consumes an already serialized snapshot; only accepted events replace it. */
export interface PublicCatalogueSource {
  read(): string;
}

export class LivePublicCatalogue implements PublicCatalogueSource {
  private bytes = "";
  private evidence = 0;
  private readonly usage = new Map<string, ComponentViewRecord>();
  private readonly configPath: string;

  constructor(
    config: ResolvedConfig,
    input: AcceptedCatalogue,
    content: number,
  ) {
    this.configPath = toPosixPath(
      path.relative(config.repoRoot, config.configPath),
    );
    this.publish(input, content, false);
  }

  read(): string {
    return this.bytes;
  }

  publish(input: AcceptedCatalogue, content: number, evidence = true): void {
    const revision = {
      content: counter(content),
      evidence: counter(this.evidence + Number(evidence)),
    };
    const model = projectCatalogue({
      ...input,
      configPath: this.configPath,
      revision,
      usage: this.usage,
    });
    model.deploymentId = identifyLiveCatalogue(model);
    const bytes = serializeCatalogue(model);
    this.evidence = revision.evidence;
    this.bytes = bytes;
  }

  clearUsage(): void {
    this.usage.clear();
  }

  acceptDocument(
    document: CompiledDocument,
    input: AcceptedCatalogue,
    content: number,
  ): void {
    const view = input.catalogue.manifest.entries
      .flatMap(generatedViews)
      .find((view) => view.path === document.route);
    if (!view) return;
    this.usage.set(
      document.route,
      document.view ?? {
        viewport: view.viewport,
        colorScheme: view.colorScheme,
        instances: [],
        slots: [],
        ranges: [],
        styles: [],
        resources: [],
      },
    );
    this.publish(input, content);
  }
}
