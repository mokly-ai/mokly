import type { Viewport } from "@mokly/mokly";

import { ContentList } from "../../../entries/design/content-list.mockup";
import type { HistoryEntry } from "../../../fixtures/build-history";
import { referenceHistory } from "../../../fixtures/build-history";
import { publication, publicationTones } from "../../../fixtures/publications";
import type { ScreenState } from "../../../fixtures/product-states";
import { failureReference } from "../../../fixtures/product-states";
import { Action, Pending, StateMessage } from "../page-parts";
import { ViewerPanelScreen } from "./screen";

const title = "Publication history";

/** Where a row leads: a build opens its own details, never a catalogue. */
function destination(entry: HistoryEntry) {
  if (entry.kind === "publication" && entry.current) return {};
  if (entry.kind === "build")
    return {
      to:
        entry.state === "failed"
          ? "product/viewer/standalone/build/failed"
          : "product/viewer/standalone/build",
      action: "Details",
    };
  return entry.state === "failed"
    ? { to: "product/viewer/standalone/failed", action: "Details" }
    : { to: "product/viewer/standalone", action: "Open" };
}

/** What one row says it is, in the words publications and builds share. */
function detail(entry: HistoryEntry): string {
  if (entry.kind === "publication" && entry.current)
    return "Current publication";
  if (entry.state === "failed") return "Unable to publish";
  if (entry.state === "publishing") return "Publishing now";
  return "Ready";
}

/**
 * Newest first. The head of the publications is where the reader already is,
 * so it carries no destination. A row says when Mokly admitted the
 * publication or created the build, what became of it and which commit it
 * came from: everything `listHistory` returns about one, and it returns no
 * author. A build reads Publishing now or Unable to publish, exactly as a
 * publication does, and opens its own details.
 */
const rows = referenceHistory.map((entry) => ({
  id: entry.kind + "-" + entry.sha,
  title: entry.time,
  detail: detail(entry),
  status: publicationTones[entry.state],
  meta: entry.sha,
  mono: true,
  ...destination(entry),
}));

function HistoryPage({
  state,
  viewport,
}: {
  state: ScreenState;
  viewport: Viewport;
}) {
  return (
    <ViewerPanelScreen
      id="product/viewer/history"
      state={state}
      viewport={viewport}
      title={title}
      subtitle={publication.branch}
      close="product/viewer/standalone"
    >
      <div className="fo-panel-stack">
        {state === "loading" ? (
          // The list draws one placeholder row in the row's own frame. No
          // text place here is the read's, so it is named for screen readers.
          <Pending
            label="Loading publication history"
            labelMode="screen-reader-only"
          >
            <ContentList
              moklyInstance="history-publications"
              label={"Publications of " + publication.branch}
              rows={[
                {
                  id: "waiting",
                  title: "",
                  detail: "",
                  status: "neutral",
                  meta: "",
                  mono: true,
                  to: "product/viewer/standalone",
                  action: "Open",
                  waiting: true,
                },
              ]}
            />
          </Pending>
        ) : state === "error" ? (
          <StateMessage
            title="History couldn’t load"
            error
            reference={failureReference}
            action={
              <Action
                instance="history-retry"
                label="Try again"
                to="product/viewer/history"
                tone="primary"
                size="md"
                icon="retry"
              />
            }
          />
        ) : state === "empty" ? (
          <StateMessage
            title="No earlier publications"
            icon="branch"
            action={
              <Action
                instance="history-switch"
                label="Choose another branch"
                to="product/viewer/switcher"
                tone="primary"
                size="md"
              />
            }
          />
        ) : (
          <ContentList
            moklyInstance="history-publications"
            label={"Publications of " + publication.branch}
            rows={rows}
          />
        )}
      </div>
    </ViewerPanelScreen>
  );
}

export function ViewerHistoryScreen({ viewport }: { viewport: Viewport }) {
  return <HistoryPage viewport={viewport} state="default" />;
}

export function ViewerHistoryEmptyScreen({ viewport }: { viewport: Viewport }) {
  return <HistoryPage viewport={viewport} state="empty" />;
}

export function ViewerHistoryLoadingScreen({
  viewport,
}: {
  viewport: Viewport;
}) {
  return <HistoryPage viewport={viewport} state="loading" />;
}

export function ViewerHistoryErrorScreen({ viewport }: { viewport: Viewport }) {
  return <HistoryPage viewport={viewport} state="error" />;
}
