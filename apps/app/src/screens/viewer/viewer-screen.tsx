import { useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";

import type { Workspace, Project, PullRequest, Session } from "../../api/types";
import type { PagedItems, PublicationRef } from "../../data/publications";
import type { Resource } from "../../data/use-resource";
import { useDocumentTitle } from "../../layout/document-title";
import { writeLastProject } from "../../navigation/last-opened";
import { publicationPath } from "../../navigation/paths";
import { undoAddress, writeAddress } from "../../navigation/address";
import { useViewerAddressState } from "./address-state";
import type { SurfaceId } from "../../settings/panes";
import { paneQuery } from "../../settings/routes";
import { useReaderScheme } from "../../theme/scheme";
import { barPlacement } from "../../viewer/bar";
import { CompactBarProvider, useViewerBarWidth } from "../../viewer/bar-width";
import { useViewerEntry } from "../../viewer/entry";
import { overlayOpening, useOverlayFocus } from "../../viewer/focus";
import type { OverlayOpener } from "../../viewer/focus";
import { useViewerSlotHandoff } from "../../viewer/handoff";
import type { ViewerSelection } from "../../viewer/host";
import { useLatestPublication } from "../../viewer/latest";
import { ViewerHost } from "../../viewer/published";
import { viewerHref } from "../../viewer/selection";
import type { ViewerPanel } from "../../viewer/selection";
import { stageView } from "../../viewer/stage-view";
import { ViewerBody } from "./body";
import { carrierLookup, useSlotRefs } from "./carriers";
import { ViewerPanelHost } from "./panel-host";
import { useReferenceRedirect } from "./reference-redirect";
import { chromeSubject } from "./subject";
import { viewerSlots } from "./slots";
import { memberAccess, useViewerBuild } from "./viewer-build";
import { useViewerCatalogue } from "./viewer-catalogue";

/**
 * The application itself: the hosted viewer with six cloud actions composed
 * into its two top-bar slots. The route owns the selection and writes every
 * change to the URL. Nothing here is invented — the project, the reference,
 * the publication, its history, its screens and its link all come from the API.
 */
export function ViewerScreen({
  session,
  project,
  workspace,
  onRetryWorkspace,
  publicationId,
  publicationRef,
  pullRequest,
  pullRequests,
  buildId,
}: {
  session: Session;
  project: Project;
  /** Workspace chrome and the owner-only upgrade action when needed. */
  workspace: Resource<Workspace>;
  onRetryWorkspace: () => void;
  publicationId?: string;
  publicationRef?: PublicationRef;
  pullRequest?: PullRequest;
  /** The route's pull request list, which the entry reads its row from. */
  pullRequests?: Resource<PagedItems<PullRequest>>;
  /** A build address names one build and no publication. */
  buildId?: string;
}) {
  const router = useRouter();
  const workspaceValue =
    workspace.status === "ready" ? workspace.value : undefined;
  const root = useRef<HTMLDivElement>(null);
  const bar = useViewerBarWidth(root);
  // Where this width's composition puts each action. The bar draws its
  // triggers from it, More its rows, and a dismissed overlay its focus return.
  const placement = barPlacement(bar.compact);
  const handoff = useViewerSlotHandoff();
  // More is controlled here, above both the fallback and the package slot
  // trees, so its open menu survives the handoff between them instead of
  // opening on a node that is discarded a frame later. It closes when the bar
  // grows wide enough to drop More.
  const [moreOpen, setMoreOpen] = useState(false);
  const hasMore = placement.more.length > 0;
  useEffect(() => {
    if (!hasMore) setMoreOpen(false);
  }, [hasMore]);
  const { entry, reload } = useViewerEntry(
    {
      projectId: project.id,
      publicationId,
      ref: publicationRef,
      buildId,
      publishingAllowed: project.publishingAllowed,
    },
    pullRequests,
  );
  const publication =
    entry.kind === "publication" ? entry.publication : undefined;
  const build = useViewerBuild(project.id, entry, reload);
  const address = useViewerAddressState(entry, publication, build.published);
  const { pathname, search, state, corrected, defaults, panel } = address;
  // The package draws its own chrome around the cloud's slots, so it takes the
  // scheme the app chrome is drawn in rather than resolving one of its own.
  const theme = useReaderScheme();

  const catalogue = useViewerCatalogue(project, publication);

  const branch = publication?.branch ?? undefined;
  const latest = useLatestPublication({
    projectId: project.id,
    currentId: publication?.id,
    branch: publicationRef?.kind === "pull-request" ? undefined : branch,
    pullRequest:
      publicationRef?.kind === "pull-request"
        ? publicationRef.number
        : undefined,
    enabled: entry.kind === "publication",
  });

  const go = useCallback(
    (
      next: { selection: ViewerSelection; panel?: ViewerPanel },
      push: boolean,
    ) => {
      // Every viewer change is a change to this page's own query, so it is
      // written rather than routed; `src/navigation/address.ts` says why that
      // is not the router's to do.
      // The address the reader is at, with only the viewer's keys changed:
      // `?settings=` is the page's, and a correction must not discard it.
      writeAddress(viewerHref(pathname, next, defaults, search), !push);
    },
    [pathname, defaults, search],
  );

  const redirect = entry.kind === "redirect" ? entry.publicationId : undefined;
  useReferenceRedirect(redirect, project, router, address);

  useEffect(() => {
    if (corrected && !redirect) go(state, false);
  }, [corrected, go, redirect, state]);

  useEffect(() => writeLastProject(project.id), [project.id]);

  const refs = useSlotRefs();
  const overlay = address.settingsRequested ? "settings" : panel;
  useOverlayFocus(overlay, carrierLookup(refs, placement));
  // The cloud body gives up its landmark when the address names an overlay.
  // Its stable stage ancestor keeps the viewer and slot controls mounted.
  const beneath = overlay !== undefined;

  // One overlay is one entry: reaching another panel from the one that is open
  // replaces it, so closing either lands on the publication rather than on the
  // panel the reader came through.
  const openPanel = useCallback(
    (next: ViewerPanel) => {
      setMoreOpen(false);
      overlayOpening(next);
      go({ selection: state.selection, panel: next }, panel === undefined);
    },
    [go, state.selection, panel],
  );
  // Undo the entry the trigger pushed rather than writing another over it, so
  // one press of Back leaves the publication instead of retracing a step that
  // does nothing.
  const closePanel = useCallback(() => {
    if (undoAddress()) return;
    go({ selection: state.selection }, false);
  }, [go, state.selection]);
  const follow = useCallback((href: string) => router.push(href), [router]);
  // Settings is one entry over the viewer, and it changes only this page's
  // query, so it is written rather than routed like every other panel.
  const openSettings = useCallback(
    (pane: SurfaceId, opener: OverlayOpener) => {
      setMoreOpen(false);
      overlayOpening(opener);
      writeAddress(paneQuery(pathname, pane, search), false);
    },
    [pathname, search],
  );

  const subject = chromeSubject({
    entry,
    publicationRef,
    publication,
    pullRequest,
    build: build.watch,
  });
  const view = stageView({
    entry,
    project,
    workspace,
    access: catalogue.access.state,
    catalogue: catalogue.state,
    isPullRequest: publicationRef?.kind === "pull-request",
    named: publicationId !== undefined,
    member: memberAccess(session, project),
    build: build.watch,
    actions: {
      onChoose: () => openPanel("switcher"),
      onRetryEntry: reload,
      onRetryWorkspace,
      onRetryAccess: catalogue.access.retry,
      onOpenBilling: () => openSettings("billing", "stage-open-billing"),
      onRetryBuild: build.retry,
      onCancelled: build.apply,
      onReload: () => window.location.reload(),
    },
  });
  // A build address shares its build's publication once there is one.
  const shared = publication?.id ?? build.publicationId;
  const heading =
    subject.label === undefined
      ? project.name
      : project.name + " · " + subject.label;
  useDocumentTitle(beneath ? undefined : heading);

  const stage = (
    <ViewerHost
      key="publication-viewer"
      selection={state.selection}
      onSelectionChange={(selection) => go({ selection, panel }, false)}
      theme={theme}
      catalogue={catalogue.hosted}
      status={view.status}
      holdReady={handoff.holdReady}
      stageMessage={view.message}
      slots={viewerSlots({
        session,
        project,
        workspace: workspaceValue?.name ?? project.workspaceSlug,
        subject,
        view: state.selection.view,
        panel,
        settingsOpen: address.settingsPane,
        placement,
        moreOpen,
        shareable: publication?.state === "ready" || build.published === true,
        refs,
        onPanel: openPanel,
        onSettings: () => openSettings("sections", "settings"),
        onAccount: () => openSettings("account", "account"),
        onMoreOpen: setMoreOpen,
        onLatest: latest
          ? () =>
              router.push(
                publicationPath(project.workspaceSlug, project.slug, latest),
              )
          : undefined,
      })}
    />
  );

  return (
    <div
      ref={root}
      className="folio-root fo-viewer-screen"
      data-mkc-screen="viewer"
      {...handoff.rootProps}
    >
      {bar.probe}
      <CompactBarProvider compact={bar.compact}>
        <ViewerBody beneath={beneath} heading={heading} stage={stage} />
      </CompactBarProvider>
      {beneath && panel && (
        <ViewerPanelHost
          panel={panel}
          project={project}
          workspaceId={project.workspaceId}
          publicationId={shared}
          buildId={build.buildId}
          publicationRef={publicationRef ?? subject.ref}
          refLabel={subject.label}
          selection={state.selection}
          defaults={defaults}
          comparable={address.comparable}
          onClose={closePanel}
          onFollow={follow}
          onChoose={() => openPanel("switcher")}
          onSelectScreen={(screen?: string) =>
            go(
              {
                // A screen chosen to share is that screen's current content,
                // so a previous version the reader was looking at ends here.
                selection: {
                  ...state.selection,
                  screen,
                  snapshotId: undefined,
                },
                panel,
              },
              false,
            )
          }
        />
      )}
    </div>
  );
}
