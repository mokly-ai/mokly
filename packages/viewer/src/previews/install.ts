/**
 * One delegated controller for previous-version stages. Selecting a removed
 * entry is the request; ordinary browsing, filtering and background evidence
 * never ask for historical bytes. A late response is discarded unless the same
 * stage still holds the same entry, so it can never replace another entry.
 */

import { readStaticDelivery } from "../client/static_delivery.js";
import type { RemovedPreviewData } from "../shell/previews.js";

import { PREVIEW_UNAVAILABLE } from "./copy.js";
import {
  PREVIEW_ATTRIBUTE,
  previewKey,
  readPreviewDescriptor,
} from "./descriptor.js";
import { enforcePreviewReadOnly } from "./read_only.js";
import {
  renderPreviewContent,
  renderPreviewLoading,
  renderPreviewUnavailable,
} from "./render.js";
import {
  previewEndpoint,
  renewPreview,
  requestPreview,
  type LoadedPreview,
} from "./request.js";

/** Lifecycle of the preview controller owned by one shell or viewer root. */
export interface InstalledPreviews {
  /** Forget the open stage and cancel its request. */
  reset(): void;
  /** Request, renew or re-render the selected entry's previous version. */
  update(refresh?: boolean): void;
}

export function installPreviews(
  doc: Document,
  win: Window & typeof globalThis,
): InstalledPreviews {
  let host: Element | undefined;
  let key: string | undefined;
  let loaded: LoadedPreview | undefined;
  let request: AbortController | undefined;

  const reset = (): void => {
    request?.abort();
    request = undefined;
    host = undefined;
    key = undefined;
    loaded = undefined;
  };
  const owns = (
    target: Element,
    selection: string,
    pending: AbortController,
  ): boolean =>
    !pending.signal.aborted &&
    host === target &&
    key === selection &&
    target.isConnected;

  const load = async (
    data: RemovedPreviewData,
    target: Element,
    selection: string,
    refresh: boolean,
    cached?: LoadedPreview,
  ): Promise<void> => {
    request?.abort();
    const pending = new win.AbortController();
    request = pending;
    loaded = undefined;
    if (!cached) renderPreviewLoading(doc, target);
    try {
      const delivery = readStaticDelivery(doc);
      const address = previewEndpoint(
        data,
        delivery,
        win.location.href,
        refresh,
      );
      if (!address) {
        if (owns(target, selection, pending))
          renderPreviewUnavailable(doc, target);
        return;
      }
      let preview = cached;
      if (
        preview &&
        !delivery &&
        !(await renewPreview(preview, win, pending.signal))
      )
        preview = undefined;
      if (!preview) {
        if (!owns(target, selection, pending)) return;
        renderPreviewLoading(doc, target);
        preview = await requestPreview(data, address, win, pending.signal);
      }
      if (!owns(target, selection, pending)) return;
      loaded = preview;
      for (const frame of renderPreviewContent(
        doc,
        target,
        data,
        preview.content,
      ))
        enforcePreviewReadOnly(frame);
    } catch {
      if (!owns(target, selection, pending)) return;
      renderPreviewUnavailable(doc, target);
    } finally {
      if (request === pending) request = undefined;
    }
  };

  const update = (refresh = false): void => {
    const next = doc.querySelector<HTMLElement>(`[${PREVIEW_ATTRIBUTE}]`);
    if (!next) {
      reset();
      return;
    }
    const data = readPreviewDescriptor(next.getAttribute(PREVIEW_ATTRIBUTE));
    if (!data) {
      request?.abort();
      request = undefined;
      loaded = undefined;
      host = next;
      key = undefined;
      renderPreviewUnavailable(doc, next);
      return;
    }
    const selection = previewKey(data);
    const replaced = next !== host || selection !== key;
    if (replaced) {
      request?.abort();
      request = undefined;
      loaded = undefined;
    }
    host = next;
    key = selection;
    if (!replaced && request && !refresh) return;
    void load(
      data,
      next,
      selection,
      refresh,
      replaced || refresh ? undefined : loaded,
    );
  };

  doc.addEventListener("click", (event) => {
    const target =
      event.target instanceof win.Element ? event.target : undefined;
    if (target?.closest(`[${PREVIEW_UNAVAILABLE.retry.attribute}]`))
      update(true);
  });
  return { reset, update };
}
