import { createRoot } from "react-dom/client";

import {
  MoklyViewer,
  postMessageAdapter,
  sameOriginAdapter,
} from "@mokly/viewer";
import type {
  CatalogueReadModel,
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
  screenId: query.get("entry") ?? "removed-page",
  view: "changes",
  viewport: "both",
  colorScheme: "light",
  search: "",
  tags: [],
};

createRoot(element).render(
  <MoklyViewer
    baseUrl={cross ? data.frameOrigin : location.origin}
    catalogue={data.catalogue}
    defaultSelection={selection}
    frameAdapter={
      cross
        ? postMessageAdapter({ frameOrigin: data.frameOrigin })
        : sameOriginAdapter()
    }
    onError={(error) => errors.push(error)}
    viewerId="removed-preview"
  />,
);
