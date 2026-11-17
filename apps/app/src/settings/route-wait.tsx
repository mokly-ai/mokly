import { useRef } from "react";
import type { ReactNode } from "react";

import type { Session } from "../api/types";
import { PaneError } from "../components/resource-state";
import type { Resource } from "../data/use-resource";
import { ViewerMain } from "../screens/viewer/body";
import { ViewerStage } from "../viewer/placeholder";

import { paneTitle } from "./pane-view";
import { availablePanes } from "./panes";
import type { SurfaceId } from "./panes";
import { paneRoute } from "./routes";
import type { SettingsScopeSlugs } from "./routes";
import { scopeSlugs } from "./scope";
import type { SettingsScope } from "./scope";
import { ScopeWait, scopePanes } from "./scope-wait";
import { SettingsDialog } from "./surface";

/**
 * A durable settings route on a wide surface, until it hands over to the
 * dialog over the page that the reader belongs on: that dialog's own wait for
 * the pane the route names, over the stage placeholder that stands for the
 * page. The route reads the session, the scope and then the page to hand over
 * to, so the reader sees this for all three, also on a return from Stripe's
 * Checkout or Customer Portal.
 *
 * The hand-over most often lands on a project's viewer, so the rail draws the
 * panes that an owner has there, the project's included, as the dialog's own
 * wait then does. Each leads to its own route by the slugs that the address
 * names, then by the scope's once it is read, and `onRoute` replaces the
 * route with it. A pane that needs a slug neither gives has no address yet,
 * and its entry waits disabled. A failed scope read says so in the dialog, as
 * the dialog does, and `onRetry` reads it again. `session` is nothing while
 * the session read runs. `discard` is the unsaved-work question, while it is
 * asked.
 */
export function SettingsRouteWait({
  pane,
  session,
  slugs,
  scope,
  onRetry,
  onRoute,
  onClose,
  discard,
}: {
  pane: SurfaceId;
  session: Session | undefined;
  slugs: SettingsScopeSlugs;
  scope: Resource<SettingsScope>;
  onRetry: () => void;
  onRoute: (href: string) => void;
  onClose: () => void;
  discard: ReactNode;
}) {
  const activeRef = useRef<HTMLAnchorElement | null>(null);
  const failure = scope.status === "error" ? scope.error : undefined;
  const available = failure
    ? availablePanes({ workspace: false, project: false, role: undefined })
    : scopePanes(true);
  const shown = failure ? "sections" : pane;
  const read = scopeSlugs(scope.status === "ready" ? scope.value : undefined);
  const href = (target: SurfaceId) =>
    paneRoute(target, {
      workspaceSlug: slugs.workspaceSlug ?? read.workspaceSlug,
      projectSlug: slugs.projectSlug ?? read.projectSlug,
    });
  // The drawn pane's own entry is where the reader already is, so pressing it
  // changes nothing, and the route keeps its query, such as a Checkout
  // return's, for the hand-over.
  const goToPane = (target: SurfaceId) => {
    const address = target === shown ? undefined : href(target);
    if (address !== undefined) onRoute(address);
  };
  return (
    <div className="folio-root fo-viewer-screen">
      <ViewerMain beneath>
        <ViewerStage />
      </ViewerMain>
      <SettingsDialog
        pane={shown}
        title={paneTitle(shown)}
        available={available}
        href={href}
        goToPane={goToPane}
        onClose={onClose}
        activeRef={activeRef}
      >
        {discard}
        {failure ? (
          <PaneError
            title="Settings couldn’t load"
            error={failure}
            onRetry={onRetry}
          />
        ) : (
          <ScopeWait pane={pane} panes={available} session={session} />
        )}
      </SettingsDialog>
    </div>
  );
}
