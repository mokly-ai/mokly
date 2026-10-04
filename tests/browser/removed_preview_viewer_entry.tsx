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

interface Fixture {
  catalogue: CatalogueReadModel;
  frameOrigin: string;
}

const data = (window as unknown as { fixture: Fixture }).fixture;
const messages: string[] = [];
(window as unknown as { frameMessages: string[] }).frameMessages = messages;
const errors: ViewerError[] = [];
(window as unknown as { viewerErrors: ViewerError[] }).viewerErrors = errors;
const navigations: ScreenNavigateEvent[] = [];
(
  window as unknown as { viewerNavigations: ScreenNavigateEvent[] }
).viewerNavigations = navigations;
window.addEventListener("message", (event) => {
  messages.push(String(event.data));
});

const query = new URLSearchParams(location.search);
const cross = query.get("adapter") === "cross";
const element = document.createElement("section");
element.id = "viewer";
element.style.cssText = "height:900px;width:1200px;position:relative";
document.body.append(element);

const selection: ViewerSelection = {
  screenPath: query.get("entry") ?? "removed-page",
  view: query.get("view") === "all" ? "all" : "changes",
  viewport: "both",
  colorScheme: "light",
  search: "",
  tags: [],
};

const adapter = cross
  ? postMessageAdapter({ frameOrigin: data.frameOrigin })
  : sameOriginAdapter();
const root = createRoot(element);

function render(catalogue: CatalogueReadModel): void {
  root.render(
    <MoklyViewer
      baseUrl={cross ? data.frameOrigin : location.origin}
      catalogue={catalogue}
      defaultSelection={selection}
      frameAdapter={adapter}
      onError={(error) => errors.push(error)}
      onScreenNavigate={(event) => navigations.push(event)}
      viewerId="removed-preview"
    />,
  );
}

render(data.catalogue);
/** Replace the catalogue source with an equal copy, as a host refresh does. */
(window as unknown as { replaceSource: () => void }).replaceSource = () =>
  render({ ...data.catalogue });
