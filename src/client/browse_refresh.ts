import {
  loadCatalogueRevisionAdopter,
  applyNavigationEvidence,
  navigationPending,
  readPageStamp,
  waitForNavigation,
  workspaceEvidence,
} from "@mokly/viewer/runtime";
/** Latest snapshot delivery for same-content background updates, fenced against navigation. */

export async function refreshBrowseEvidence(
  doc: Document,
  win: Window & typeof globalThis,
  version: number,
  signal: AbortSignal,
): Promise<number | undefined> {
  if (!readPageStamp(doc)) return;
  while (!signal.aborted) {
    await waitForNavigation(doc, signal);
    const href = win.location.href;
    const view = doc.querySelector("[data-mokly-view]")?.firstElementChild;
    const response = await win.fetch(href, {
      signal,
      cache: "no-store",
      headers: { accept: "text/html" },
    });
    const html = await response.text();
    signal.throwIfAborted();
    if (
      navigationPending(doc) ||
      href !== win.location.href ||
      view !== doc.querySelector("[data-mokly-view]")?.firstElementChild
    )
      continue;
    if (!response.ok || response.url !== href.split("#")[0]) return;
    const next = new win.DOMParser().parseFromString(html, "text/html");
    const current = readPageStamp(doc);
    const stamp = readPageStamp(next);
    if (
      !current ||
      !stamp ||
      stamp.content !== current.content ||
      stamp.version < Math.max(version, current.version) ||
      doc
        .querySelector("[data-mokly-view]")
        ?.getAttribute("data-mokly-baseline") !==
        next
          .querySelector("[data-mokly-view]")
          ?.getAttribute("data-mokly-baseline")
    )
      return;
    const publicResponse = await win.fetch(
      new URL("/__mokly/catalogue.json", href),
      { signal, cache: "no-store", credentials: "omit" },
    );
    if (
      !publicResponse.ok ||
      signal.aborted ||
      navigationPending(doc) ||
      href !== win.location.href
    )
      return;
    const catalogue: unknown = await publicResponse.json();
    signal.throwIfAborted();
    const adoptCatalogueRevision = await loadCatalogueRevisionAdopter();
    signal.throwIfAborted();
    if (
      navigationPending(doc) ||
      href !== win.location.href ||
      view !== doc.querySelector("[data-mokly-view]")?.firstElementChild ||
      readPageStamp(doc)?.version !== current.version
    )
      continue;
    if (publicResponse.url !== new URL("/__mokly/catalogue.json", href).href)
      return;
    if (!adoptCatalogueRevision(doc, catalogue)) return;
    const evidence = workspaceEvidence(doc, next);
    if (!evidence) return;
    applyNavigationEvidence(doc, next);
    evidence();
    doc.documentElement.setAttribute(
      "data-mokly-update-version",
      String(stamp.version),
    );
    doc.dispatchEvent(new win.Event("mokly:evidence-updated"));
    return stamp.version;
  }
  return undefined;
}
