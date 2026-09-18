/** Browser entry for hydrating a standalone server-rendered shell document. */

import { hydrateRoot } from "react-dom/client";

import { parseStaticDelivery } from "./navigation/delivery.js";
import {
  readShellBootstrap,
  shellBootstrapProps,
  shellBootstrapWithDelivery,
} from "./standalone/bootstrap.js";
import { StandaloneShellDocument } from "./standalone/document.js";
import { readEarlyDisclosures } from "./standalone/early_disclosures.js";

const hydratedDocuments = new WeakSet<Document>();

/** Hydrate one complete standalone shell when its bootstrap state is present. */
export function hydrateMoklyShell(doc: Document = document): void {
  if (hydratedDocuments.has(doc)) return;
  const state = doc.querySelector<HTMLScriptElement>(
    "script[data-mokly-shell-bootstrap]",
  );
  if (!state?.textContent) return;
  const bootstrap = readShellBootstrap(JSON.parse(state.textContent));
  const rawDelivery = doc.documentElement.getAttribute("data-mokly-delivery");
  let effective = bootstrap;
  if (rawDelivery !== null) {
    let value: unknown;
    try {
      value = JSON.parse(rawDelivery);
    } catch {
      throw new Error("Invalid finalized shell delivery metadata.");
    }
    const delivery = parseStaticDelivery(value);
    if (!delivery)
      throw new Error("Invalid finalized shell delivery metadata.");
    effective = shellBootstrapWithDelivery(bootstrap, delivery);
  }
  const props = shellBootstrapProps(effective);
  hydratedDocuments.add(doc);
  hydrateRoot(
    doc,
    <StandaloneShellDocument
      {...props}
      bootstrap={bootstrap}
      initialDisclosures={readEarlyDisclosures(doc)}
    />,
  );
}

if (typeof document !== "undefined") hydrateMoklyShell();
