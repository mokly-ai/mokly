import fs from "node:fs";

import { readCatalogue } from "@mokly/viewer";
import type {
  ShellCatalogueReadModel,
  ViewerCapabilityDescriptor,
  ViewerCapabilityRequest,
} from "@mokly/viewer/runtime";
import type { WorkspaceData } from "@mokly/viewer/server";

import type { ReactCapabilityEnvironment } from "../../dist/client/react_capabilities.js";

export const catalogue = readCatalogue(
  JSON.parse(
    fs.readFileSync("docs/protocol/fixtures/catalogue-v1.json", "utf8"),
  ),
);

export const descriptor: ViewerCapabilityDescriptor = {
  schemaVersion: 1,
  source: {
    base: "origin/main",
    catalogueId: catalogue.identity.id,
    contentRevision: catalogue.revision.content,
    evidenceRevision: catalogue.revision.evidence,
    previewGeneration: "a".repeat(32),
    renderGeneration: "a".repeat(32),
    updateVersion: 4,
  },
  renderCapability: {
    generation: "a".repeat(32),
    token: "b".repeat(64),
  },
  workspace: workspaceEvidence(),
};

export function currentRequest(): ViewerCapabilityRequest {
  return {
    route: descriptor.workspace!.entry.route,
    source: descriptor.source,
  };
}

export function actions() {
  return {
    adoptEvidence: async () => true,
    captureRecovery: shellRecovery,
  };
}

export function shellRecovery() {
  return {
    closedCollectionIds: ["collection:fixture"],
    colorScheme: "dark" as const,
    detailsOpen: true,
    drawerOpen: true,
    filterBaselineClosedCollectionIds: ["collection:fixture"],
    navScroll: 18,
    query: "home",
    regionScrolls: { stage: 42 },
    view: "changes" as const,
    viewport: "mobile" as const,
  };
}

export function browseRecovery() {
  const { view: _view, ...recovery } = shellRecovery();
  return { ...recovery, changedOnly: true };
}

export class FakeSource {
  closed = false;
  private listeners = new Map<string, (event: { data: string }) => void>();

  addEventListener(
    type: "ready" | "update",
    callback: (event: { data: string }) => void,
  ): void {
    this.listeners.set(type, callback);
  }

  close(): void {
    this.closed = true;
  }

  emit(type: "ready" | "update", data: string): void {
    this.listeners.get(type)?.({ data });
  }
}

class FakeStorage {
  private values = new Map<string, string>();

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  removeItem(key: string): void {
    this.values.delete(key);
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }
}

export class FakeEnvironment implements ReactCapabilityEnvironment {
  descriptor = descriptor;
  publicCatalogue: ShellCatalogueReadModel = catalogue;
  pageHideImmediately = false;
  pageHideStops = 0;
  readonly sources: FakeSource[] = [];
  readonly requests: string[] = [];
  readonly responses: Response[] = [];
  readonly storage = new FakeStorage();
  readonly location = {
    href: "http://localhost/view/components/button.html",
    reloads: 0,
    reload() {
      this.reloads += 1;
    },
  };

  createEventSource(): FakeSource {
    const source = new FakeSource();
    this.sources.push(source);
    return source;
  }

  fetch = async (input: RequestInfo | URL): Promise<Response> => {
    this.requests.push(String(input));
    return this.responses.shift()!;
  };

  onPageHide(callback: () => void): () => void {
    if (this.pageHideImmediately) callback();
    return () => {
      this.pageHideStops += 1;
    };
  }

  parseDocument(): Document {
    return {
      querySelector: (selector: string) => {
        const value = selector.includes("data-mokly-shell-bootstrap")
          ? this.shellBootstrap()
          : this.descriptor;
        return { textContent: JSON.stringify(value) };
      },
    } as unknown as Document;
  }

  private shellBootstrap() {
    const source = this.descriptor.source;
    const pathname = new URL(this.location.href).pathname;
    const route =
      this.descriptor.workspace?.entry.route ??
      (pathname.startsWith("/view/")
        ? decodeURIComponent(pathname.slice("/view/".length))
        : undefined);
    return {
      catalogue: this.publicCatalogue,
      context: {
        base: source.base,
        comparisons: true,
        contentVersion: source.contentRevision,
        updateVersion: source.updateVersion,
        ...(source.previewGeneration
          ? { previewGeneration: source.previewGeneration }
          : {}),
      },
      view: route ? { kind: "target", route } : { kind: "home" },
    };
  }
}

export function workspaceEvidence(
  route = catalogue.components[0]!.route,
): WorkspaceData {
  const entry = [...catalogue.screens, ...catalogue.components].find(
    (candidate) => candidate.route === route,
  );
  if (!entry) throw new Error("Unknown workspace fixture route.");
  return {
    affected: [],
    base: "origin/main",
    changedViews: {},
    comparisonEligible: false,
    comparisons: true,
    components: [],
    entry: { ...entry, variants: [] } as unknown as WorkspaceData["entry"],
    inputChanges: [],
    previewGeneration: "a".repeat(32),
    relatedComponents: [],
    removed: false,
    usedBy: [],
    variants: [],
    viewStates: {},
    views: [],
  };
}

export function htmlResponse(
  url: string,
  beforeText?: () => void,
  ok = true,
): Response {
  return {
    ok,
    url,
    text: async () => {
      beforeText?.();
      return "<html></html>";
    },
  } as Response;
}
