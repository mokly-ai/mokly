/** Complete standalone shell document shared by static SSR and hydration. */

import { useEffect, useRef } from "react";

import type { ViewerHostCapabilities } from "../client/host_capabilities.js";
import type { ViewerCapabilityDescriptor } from "../client/host_capability_descriptor.js";
import { serializeViewerCapabilityDescriptor } from "../client/host_capability_descriptor.js";
import { ViewerCapabilityBoundary } from "../shell/capability_context.js";
import type { Catalogue } from "../shell/catalogue.js";
import type { ShellContext } from "../shell/context.js";
import { CatalogueNav } from "../shell/nav.js";
import { useNavigationBounds } from "../shell/nav_resize.js";
import { ShellStoreProvider } from "../shell/store.js";
import { useShellStore } from "../shell/store_context.js";
import type { ShellInitialState } from "../shell/store_state.js";
import type { ShellRecoverySnapshot } from "../shell/store_state.js";
import { TopBar } from "../shell/top_bar.js";
import { ShellMain, viewTitle } from "../shell/views.js";
import type { ShellView } from "../shell/views.js";
import type { WorkspaceData } from "../shell/workspace_data.js";
import { normalizeTheme } from "../viewer/theme.js";

import { useStandaloneAppearance } from "./appearance_bridge.js";
import {
  serializeShellBootstrap,
  type ShellBootstrapState,
} from "./bootstrap.js";
import { HYDRATED_EVENT } from "./nav_resize.js";
import type { StaticWorkspaceEvidence } from "./static_workspace_evidence.js";

export const REACT_SHELL_BUNDLE = "react-shell.js";
export const REACT_HOST_BUNDLE = "react-host.js";

/** Render the standalone document without changing the existing shell tree. */
export function StandaloneShellDocument({
  bootstrap,
  catalogue,
  capabilities,
  capabilityDescriptor,
  context,
  initialState,
  initialWorkspace,
  recovery,
  staticEvidence,
  view,
}: {
  bootstrap?: ShellBootstrapState;
  catalogue: Catalogue;
  capabilities?: ViewerHostCapabilities;
  capabilityDescriptor?: ViewerCapabilityDescriptor;
  context: ShellContext;
  initialState?: ShellInitialState | undefined;
  initialWorkspace?: WorkspaceData;
  recovery?: ShellRecoverySnapshot;
  staticEvidence?: StaticWorkspaceEvidence;
  view: ShellView;
}) {
  const workspace = capabilityDescriptor?.workspace ?? initialWorkspace;
  return (
    <ViewerCapabilityBoundary
      {...(capabilities ? { capabilities } : {})}
      {...(capabilityDescriptor
        ? { initialSource: capabilityDescriptor.source }
        : {})}
      {...(workspace ? { initialWorkspace: workspace } : {})}
      {...(staticEvidence ? { staticEvidence } : {})}
    >
      <ShellStoreProvider
        catalogue={catalogue}
        context={context}
        interactive={bootstrap !== undefined}
        {...(recovery ? { recovery } : {})}
        view={view}
        {...(initialState ? { initialState } : {})}
      >
        <StandaloneDocumentContents
          {...(bootstrap ? { bootstrap } : {})}
          {...(capabilityDescriptor ? { capabilityDescriptor } : {})}
        />
      </ShellStoreProvider>
    </ViewerCapabilityBoundary>
  );
}

function StandaloneDocumentContents({
  bootstrap,
  capabilityDescriptor,
}: {
  bootstrap?: ShellBootstrapState;
  capabilityDescriptor?: ViewerCapabilityDescriptor;
}) {
  const store = useShellStore();
  const catalogue = store.catalogue;
  const hydrated = store.interactive;
  const context = store.context;
  const view = store.state.route.view;
  const appearance = useStandaloneAppearance(store);
  const shell = useRef<HTMLDivElement>(null);
  useNavigationBounds(shell);
  return (
    <html
      data-mokly-base={context.base}
      data-mokly-static={context.delivery ? "" : undefined}
      data-mokly-delivery={
        context.delivery ? JSON.stringify(context.delivery) : undefined
      }
      data-mokly-appearance=""
      data-mokly-theme={normalizeTheme(appearance.theme)}
      data-mokly-update-version={context.updateVersion}
      data-mokly-content-version={
        context.delivery ? undefined : context.contentVersion
      }
      data-mokly-host-capabilities={capabilityDescriptor ? "" : undefined}
      data-mokly-react-shell={hydrated ? "" : undefined}
      lang="en"
    >
      <head>
        <meta charSet="utf-8" />
        <meta content="width=device-width, initial-scale=1" name="viewport" />
        <title>{viewTitle(catalogue, view)}</title>
        {hydrated ? <link href="data:," rel="icon" /> : null}
        <script src="/__mokly/client/appearance-startup.js" />
        <link href="/__mokly/shell.css" rel="stylesheet" />
      </head>
      <body
        className={`mbk-fs${store.state.expandedFrame ? " frame-expanded" : ""}`}
        data-mokly-color-scheme={hydrated ? appearance.scheme : undefined}
        onClick={store.onShellClick}
        onKeyDown={store.onShellKeyDown}
      >
        <div
          className="mbk"
          data-drawer={store.state.drawerOpen ? "open" : "closed"}
          data-mokly-shell=""
          ref={shell}
        >
          <a className="mbk-skip-link" href="#mb-main">
            Skip to content
          </a>
          <TopBar appearance={appearance} catalogue={catalogue} />
          <div className="mbk-body">
            <CatalogueNav catalogue={catalogue} context={context} />
            <ShellMain catalogue={catalogue} context={context} view={view} />
          </div>
          <p
            aria-atomic="true"
            aria-live="polite"
            className="mbk-route-status"
            id="mb-status"
            role="status"
          >
            {store.state.announcement}
          </p>
        </div>
        {bootstrap ? (
          <script
            data-mokly-shell-bootstrap=""
            type="application/json"
            dangerouslySetInnerHTML={{
              __html: serializeShellBootstrap(bootstrap),
            }}
          />
        ) : null}
        {capabilityDescriptor ? (
          <script
            data-mokly-host-capability-state=""
            type="application/json"
            dangerouslySetInnerHTML={{
              __html: serializeViewerCapabilityDescriptor(capabilityDescriptor),
            }}
          />
        ) : null}
        <script src="/__mokly/client/navigation-resize.js" />
        {hydrated ? (
          <script
            src={`/__mokly/client/${capabilityDescriptor ? REACT_HOST_BUNDLE : REACT_SHELL_BUNDLE}`}
            type="module"
          />
        ) : null}
        {hydrated ? <HydrationMarker /> : null}
      </body>
    </html>
  );
}

function HydrationMarker() {
  useEffect(() => {
    document.documentElement.dataset["moklyHydrated"] = "";
    window.dispatchEvent(new Event(HYDRATED_EVENT));
  }, []);
  return null;
}
