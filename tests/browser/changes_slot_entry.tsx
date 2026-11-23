/**
 * The host page of `changes_slot_host.ts`: it mounts the public `MoklyViewer`
 * over the copied comparison output with `sameOriginAdapter()`, on the entry
 * that the `entry` query names. The `slot` query chooses the host's content
 * for the Changes tab's `changesStart` slot: `link`, a host check with a link
 * to the address that the `link` query names, or `empty`, a host component
 * that renders nothing. Without the query, the host gives no slots.
 */

import { createRoot } from "react-dom/client";

import { MoklyViewer, sameOriginAdapter } from "@mokly/viewer";
import type { CatalogueReadModel, ViewerSlots } from "@mokly/viewer";

/** A host component whose content has not arrived, so it renders nothing. */
function PendingCheck() {
  return null;
}

/** The `changesStart` content that the query chooses. */
function changesSlots(query: URLSearchParams): ViewerSlots | undefined {
  const choice = query.get("slot");
  if (choice === "link")
    return {
      changesStart: (
        <p>
          Host check passed.{" "}
          <a href={query.get("link") ?? undefined}>Open the host page</a>
        </p>
      ),
    };
  if (choice === "empty") return { changesStart: <PendingCheck /> };
  return undefined;
}

const query = new URLSearchParams(location.search);
const response = await fetch(
  new URL("/mokly-viewer/index.json", location.origin),
);
const index = (await response.json()) as CatalogueReadModel;
const element = document.createElement("section");
element.id = "viewer";
element.style.cssText = "height:900px;width:1400px;position:relative";
document.body.append(element);
const slots = changesSlots(query);
createRoot(element).render(
  <MoklyViewer
    baseUrl={location.origin}
    defaultSelection={{
      screenPath: query.get("entry"),
      view: "all",
      viewport: "both",
      colorScheme: "light",
    }}
    detail={(path: string) =>
      new URL(`/mokly-viewer/entries/${path}.json`, location.origin)
    }
    frameAdapter={sameOriginAdapter()}
    index={index}
    {...(slots ? { slots } : {})}
  />,
);
