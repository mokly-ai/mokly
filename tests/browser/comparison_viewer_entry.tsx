/**
 * The host page of `comparison_viewer_host.ts`: it mounts the public
 * `MoklyViewer` over the copied comparison output. The query selects the
 * frame adapter (`adapter=same-origin` or `adapter=cross`), the entry and its
 * snapshot, the catalogue filter, and the viewport. `base=none` removes the
 * index's `base`, as in a public index without a branch name, and
 * `responsive=1` gives the viewer the page width.
 */

import { createRoot } from "react-dom/client";

import {
  MoklyViewer,
  postMessageAdapter,
  sameOriginAdapter,
} from "@mokly/viewer";
import type {
  CatalogueReadModel,
  ScreenNavigateEvent,
  ViewerError,
  ViewerSelection,
} from "@mokly/viewer";

/** What a spec reads from, or calls on, the host window. */
interface HostProbe {
  fixture: { frameOrigin: string };
  frameMessages: string[];
  viewerErrors: ViewerError[];
  viewerNavigations: ScreenNavigateEvent[];
  replaceSource(): void;
}

const probe = window as unknown as HostProbe;
const query = new URLSearchParams(location.search);
const cross = query.get("adapter") === "cross";
const origin = cross ? probe.fixture.frameOrigin : location.origin;
probe.frameMessages = [];
probe.viewerErrors = [];
probe.viewerNavigations = [];
window.addEventListener("message", (event) => {
  probe.frameMessages.push(String(event.data));
});

const viewport = query.get("viewport");
const snapshotId = query.get("snapshot");
const selection: Partial<ViewerSelection> = {
  screenPath: query.get("entry"),
  ...(snapshotId ? { snapshotId } : {}),
  view: query.get("view") === "changes" ? "changes" : "all",
  viewport: viewport === "mobile" || viewport === "desktop" ? viewport : "both",
  colorScheme: "light",
};

const response = await fetch(new URL("/mokly-viewer/index.json", origin));
const index = (await response.json()) as Record<string, unknown>;
if (query.get("base") === "none") delete index["base"];
const generation = String(index["comparisonUrl"]).replace(/review\.json$/u, "");
const detail = (path: string, snapshot?: string) =>
  new URL(
    snapshot === undefined
      ? `/mokly-viewer/entries/${path}.json`
      : `/${generation}entries/${path}.json`,
    origin,
  );

const element = document.createElement("section");
element.id = "viewer";
element.style.cssText = `height:900px;width:${query.get("responsive") ? "100%" : "1200px"};position:relative`;
if (query.get("responsive")) document.body.style.margin = "0";
document.body.append(element);
const root = createRoot(element);
const frameAdapter = cross
  ? postMessageAdapter({ frameOrigin: origin })
  : sameOriginAdapter();

function render(source: CatalogueReadModel): void {
  root.render(
    <MoklyViewer
      baseUrl={origin}
      defaultSelection={selection}
      detail={detail}
      frameAdapter={frameAdapter}
      index={source}
      onError={(error) => probe.viewerErrors.push(error)}
      onScreenNavigate={(event) => probe.viewerNavigations.push(event)}
    />,
  );
}

render(index as unknown as CatalogueReadModel);
/** Replace the index source with an equal copy, as a host refresh does. */
probe.replaceSource = () =>
  render({ ...index } as unknown as CatalogueReadModel);
