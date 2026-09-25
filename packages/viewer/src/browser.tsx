/** Browser entry for hydrating a standalone server-rendered shell document. */

import { hydrateRoot } from "react-dom/client";

import { readCatalogue } from "./catalogue/reader.js";
import type { ViewerHostCapabilities } from "./client/host_capabilities.js";
import {
  readViewerCapabilityDescriptor,
  type ViewerCapabilityDescriptor,
  viewerCapabilityRequest,
  viewerCapabilitySourceEquals,
} from "./client/host_capability_descriptor.js";
import { readViewerWorkspace } from "./client/workspace_descriptor.js";
import type { StaticDelivery } from "./navigation/delivery.js";
import { readShellDelivery } from "./shell/delivery.js";
import { catalogueNavSections, disclosurePath } from "./shell/nav_model.js";
import { refreshStandaloneAppearance } from "./standalone/appearance_host.js";
import {
  resolveShellBootstrap,
  shellBootstrapProps,
  shellBootstrapWithDelivery,
  type ExternalShellBootstrap,
  type ShellBootstrap,
  type ShellBootstrapState,
} from "./standalone/bootstrap.js";
import { isExternalCatalogueReference } from "./standalone/catalogue_reference.js";
import { StandaloneShellDocument } from "./standalone/document.js";
import { prepareHydrationState } from "./standalone/preferences.js";
import {
  LIVE_SHELL_BOOTSTRAP_MODE,
  readLiveShellBootstrapState,
  type LiveShellBootstrap,
  type LiveShellBootstrapState,
} from "./standalone/scoped_bootstrap.js";
import { staticWorkspaceEvidence } from "./standalone/static_workspace_evidence.js";

const hydratedDocuments = new WeakSet<Document>();
const pendingDocuments = new WeakSet<Document>();

interface EmbeddedCapabilityDescriptor {
  descriptor?: ViewerCapabilityDescriptor;
  json?: string;
}

type ResolvedHydrationInput =
  | { kind: "live"; bootstrap: LiveShellBootstrap }
  | { kind: "static"; bootstrap: ShellBootstrap };

/** Hydrate one complete standalone shell with optional live host capabilities. */
export function hydrateMoklyShell(
  doc: Document = document,
  capabilities?: ViewerHostCapabilities,
): void {
  if (hydratedDocuments.has(doc) || pendingDocuments.has(doc)) return;
  const delivery = readShellDelivery(doc);
  const state = doc.querySelector<HTMLScriptElement>(
    "script[data-mokly-shell-bootstrap]",
  );
  if (!state?.textContent) return;
  const bootstrapJson = state.textContent;
  const bootstrapState = readLiveShellBootstrapState(
    JSON.parse(bootstrapJson),
    LIVE_SHELL_BOOTSTRAP_MODE,
  );
  const embeddedCapability = readCapabilityDescriptor(doc, capabilities);
  if (!isExternalShellBootstrap(bootstrapState)) {
    const bootstrap = bootstrapState;
    hydrateResolvedShell(
      doc,
      bootstrapJson,
      {
        kind: "live",
        bootstrap: delivery
          ? shellBootstrapWithDelivery(bootstrap, delivery)
          : bootstrap,
      },
      capabilities,
      embeddedCapability,
    );
    return;
  }
  const win = doc.defaultView;
  if (!delivery || !win) return;
  pendingDocuments.add(doc);
  const controller = new win.AbortController();
  const abort = () => controller.abort();
  win.addEventListener("pagehide", abort, { once: true });
  void loadExternalBootstrap(win, bootstrapState, delivery, controller.signal)
    .then((bootstrap) => {
      if (!bootstrap || controller.signal.aborted) return;
      hydrateResolvedShell(
        doc,
        bootstrapJson,
        { kind: "static", bootstrap },
        capabilities,
        embeddedCapability,
      );
    })
    .finally(() => {
      pendingDocuments.delete(doc);
      win.removeEventListener("pagehide", abort);
    });
}

function readCapabilityDescriptor(
  doc: Document,
  capabilities: ViewerHostCapabilities | undefined,
): EmbeddedCapabilityDescriptor {
  const capabilityState = doc.querySelector<HTMLScriptElement>(
    "script[data-mokly-host-capability-state]",
  );
  const json = capabilityState?.textContent || undefined;
  const descriptor = json
    ? readViewerCapabilityDescriptor(JSON.parse(json))
    : undefined;
  if (
    (capabilities === undefined) !== (descriptor === undefined) ||
    (capabilities &&
      descriptor &&
      !viewerCapabilitySourceEquals(descriptor.source, capabilities.source))
  )
    throw new Error("Live viewer capabilities do not match this document.");
  return {
    ...(descriptor ? { descriptor } : {}),
    ...(json ? { json } : {}),
  };
}

function hydrateResolvedShell(
  doc: Document,
  bootstrapJson: string,
  input: ResolvedHydrationInput,
  capabilities: ViewerHostCapabilities | undefined,
  embeddedCapability: EmbeddedCapabilityDescriptor,
): void {
  if (hydratedDocuments.has(doc)) return;
  refreshStandaloneAppearance(doc);
  const bootstrap = input.bootstrap;
  const props = shellBootstrapProps(bootstrap);
  const staticBootstrap = input.kind === "static" ? input.bootstrap : undefined;
  const delivery = staticBootstrap?.context.delivery;
  const workspaceState =
    delivery === undefined
      ? undefined
      : doc.querySelector<HTMLScriptElement>("script[data-workspace-data]");
  const initialWorkspace = workspaceState?.textContent
    ? readViewerWorkspace(JSON.parse(workspaceState.textContent), props.context)
    : undefined;
  const staticEvidence =
    delivery && doc.defaultView && staticBootstrap
      ? staticWorkspaceEvidence(doc.defaultView, staticBootstrap)
      : undefined;
  const activeDisclosures =
    props.view.kind === "target"
      ? disclosurePath(
          catalogueNavSections(props.catalogue),
          props.view.target.entry.route,
        )
      : [];
  const recovery = capabilities?.updates.consumeRecovery(
    viewerCapabilityRequest(
      capabilities.source,
      props.view.kind === "target" ? props.view.target.entry.route : null,
    ),
  );
  hydratedDocuments.add(doc);
  hydrateRoot(
    doc,
    <StandaloneShellDocument
      {...props}
      bootstrapJson={bootstrapJson}
      {...(capabilities ? { capabilities } : {})}
      {...(embeddedCapability.descriptor
        ? { capabilityDescriptor: embeddedCapability.descriptor }
        : {})}
      {...(embeddedCapability.json
        ? { capabilityDescriptorJson: embeddedCapability.json }
        : {})}
      initialState={prepareHydrationState(doc, activeDisclosures)}
      {...(initialWorkspace ? { initialWorkspace } : {})}
      {...(recovery ? { recovery } : {})}
      {...(staticEvidence ? { staticEvidence } : {})}
    />,
  );
}

async function loadExternalBootstrap(
  win: Window & typeof globalThis,
  state: ShellBootstrapState,
  delivery: StaticDelivery,
  signal: AbortSignal,
): Promise<ShellBootstrap | undefined> {
  if (!isExternalShellBootstrap(state)) return;
  const requested = new URL(state.catalogue.path, win.location.href);
  try {
    const response = await win.fetch(requested, {
      cache: "no-store",
      credentials: "omit",
      signal,
    });
    if (
      !response.ok ||
      signal.aborted ||
      !sameCatalogueUrl(response, requested)
    )
      return;
    const catalogue = readCatalogue(await response.json());
    if (signal.aborted || catalogue.deploymentId !== delivery.deploymentId)
      return;
    return shellBootstrapWithDelivery(
      resolveShellBootstrap(state, catalogue),
      delivery,
    );
  } catch {
    return;
  }
}

function isExternalShellBootstrap(
  state: LiveShellBootstrapState,
): state is ExternalShellBootstrap {
  return isExternalCatalogueReference(state.catalogue);
}

function sameCatalogueUrl(response: Response, requested: URL): boolean {
  const received = new URL(response.url, requested);
  return (
    received.origin === requested.origin &&
    received.pathname === requested.pathname &&
    received.search === "" &&
    received.hash === ""
  );
}

if (
  typeof document !== "undefined" &&
  !document.documentElement.hasAttribute("data-mokly-host-capabilities")
)
  hydrateMoklyShell();
