/** Progressive Browse shell enhancement served at /__mokly/client/browse.js. */

import { handleBrowseControl } from "./browse_controls.js";
import { createBrowserDetailsPreference } from "./browse_details.js";
import { applyNavigationEvidence } from "./browse_evidence.js";
import { fetchBrowseDestination } from "./browse_fetch.js";
import {
  collapseFrame,
  expandedFrame,
  handleAddressClick,
  handleFrameClick,
} from "./browse_frames.js";
import { browseLinkTarget } from "./browse_links.js";
import { createBrowserNavPreference } from "./browse_navigation.js";
import {
  applyNavVisibility,
  selectAndRevealRoute,
} from "./browse_navigation_state.js";
import {
  captureRegionScrolls,
  currentColorScheme,
  currentViewport,
  restoreRegionScrolls,
  setColorScheme,
  setDrawer,
  setViewport,
} from "./browse_state.js";
import {
  beginNavigation,
  finishNavigation,
  readPageStamp,
} from "./browse_update_state.js";
import { copyText } from "./clipboard.js";
import { installDiffs } from "./diffs.js";
import { restoreEarlyDisclosures } from "./early_disclosures.js";
import { attachFrameNavigation } from "./frame_navigation.js";
import { isSameBrowseDocument, NavigationSequencer } from "./navigation.js";
import { applyPreviewFragmentQuery } from "./preview_fragment.js";
import { documentFrameHref, normalizeStaticAlias } from "./static_delivery.js";
import {
  handleTagControlClick,
  handleTagPickerKeydown,
  syncTagChips,
} from "./tag_filter.js";
import { installWorkspace } from "./workspace.js";

interface ScrollState {
  scrolls?: Record<string, number>;
}

export function initializeBrowseShell(
  doc: Document,
  win: Window & typeof globalThis,
): void {
  const shell = doc.querySelector<HTMLElement>("[data-mokly-shell]");
  const main = doc.querySelector<HTMLElement>("[data-mokly-view]");
  if (!shell || !main) return;
  normalizeStaticAlias(doc, win);
  applyPreviewFragmentQuery(doc, win.location.search);
  const detailsPreference = createBrowserDetailsPreference(win);
  const navPreference = createBrowserNavPreference(win);
  detailsPreference.apply(doc);
  navPreference.apply(doc);
  if (win.history.scrollRestoration) win.history.scrollRestoration = "manual";
  const sequencer = new NavigationSequencer();
  let restoringHistory = false;
  let displayedUrl = new URL(win.location.href);
  const rememberDocument = (): void => {
    sequencer.cancel();
    finishNavigation(doc);
    restoringHistory = false;
    displayedUrl = new URL(win.location.href);
  };
  const diffs = installDiffs(doc, win);
  let disposeWorkspace = installWorkspace(
    doc,
    win,
    diffs.update,
    rememberDocument,
  );
  const persistScroll = (): void => {
    win.history.replaceState(
      { scrolls: captureRegionScrolls(doc) } satisfies ScrollState,
      "",
      win.location.href,
    );
  };
  let scrollFramePending = false;
  persistScroll();
  doc.addEventListener(
    "scroll",
    () => {
      if (restoringHistory || scrollFramePending) return;
      persistScroll();
      scrollFramePending = true;
      win.requestAnimationFrame(() => {
        scrollFramePending = false;
      });
    },
    { capture: true, passive: true },
  );
  doc.addEventListener(
    "toggle",
    (event) => {
      const group =
        event.target instanceof HTMLDetailsElement ? event.target : undefined;
      if (!group?.hasAttribute("data-nav-disclosure")) return;
      if (group.dataset["filterOpen"] !== undefined) return;
      navPreference.remember(doc);
    },
    true,
  );
  const announce = (message: string): void => {
    const status = doc.getElementById("mb-status");
    if (status) status.textContent = message;
  };

  const navigate = async (
    url: string,
    push: boolean,
    restoreScrolls?: Readonly<Record<string, number>>,
  ): Promise<void> => {
    if (push) restoringHistory = false;
    const slot = sequencer.begin();
    beginNavigation(doc);
    const destination = await fetchBrowseDestination(doc, win, url, slot);
    if (!destination || !slot.isCurrent()) return;
    const { parsed, view: nextMain, url: finalUrl } = destination;
    const nextStamp = readPageStamp(parsed);
    const viewport = currentViewport(doc);
    disposeWorkspace();
    for (const frame of main.querySelectorAll("iframe")) frame.remove();
    collapseFrame(doc, expandedFrame(doc));
    if (push) persistScroll();
    diffs.reset();
    main.innerHTML = nextMain.innerHTML;
    const baseline = nextMain.getAttribute("data-mokly-baseline");
    if (baseline) main.setAttribute("data-mokly-baseline", baseline);
    else main.removeAttribute("data-mokly-baseline");
    if (nextStamp) {
      applyNavigationEvidence(doc, parsed);
      doc.documentElement.setAttribute(
        "data-mokly-update-version",
        String(nextStamp.version),
      );
    }
    displayedUrl = new URL(finalUrl, win.location.href);
    attachFrameNavigation(doc, frameActions);
    applyPreviewFragmentQuery(doc, new URL(finalUrl, win.location.href).search);
    detailsPreference.apply(doc);
    setViewport(doc, viewport);
    setColorScheme(doc, currentColorScheme(doc));
    doc.title = parsed.title || doc.title;
    if (push)
      win.history.pushState(
        { scrolls: {} } satisfies ScrollState,
        "",
        finalUrl,
      );
    disposeWorkspace = installWorkspace(
      doc,
      win,
      diffs.update,
      rememberDocument,
    );
    selectAndRevealRoute(
      doc,
      new URL(finalUrl, win.location.href).pathname,
      win.location.href,
      "navigation",
    );
    syncTagChips(doc);
    finishNavigation(doc);
    setDrawer(shell, false);
    restoreRegionScrolls(doc, restoreScrolls ?? {});
    if (!push) {
      await new Promise<void>((resolve) =>
        win.requestAnimationFrame(() => resolve()),
      );
      if (!slot.isCurrent()) return;
      restoreRegionScrolls(doc, restoreScrolls ?? {});
      restoringHistory = false;
    }
    main.focus({ preventScroll: true });
    announce(`Loaded ${doc.title}`);
  };
  const frameActions = {
    navigate: (href: string): void => {
      const target = documentFrameHref(doc, href);
      if (target) void navigate(target, true);
    },
    open: (href: string, target: string): void => {
      const url = documentFrameHref(doc, href);
      if (url) win.open(url, target, "noopener");
    },
  };

  doc.addEventListener("click", (event) => {
    const target = event.target instanceof Element ? event.target : undefined;
    if (!target) return;
    if (handleTagControlClick(doc, target)) return;
    const summary = target.closest("summary");
    const details = summary?.parentElement;
    if (
      details instanceof HTMLDetailsElement &&
      details.matches("[data-mokly-details]")
    ) {
      detailsPreference.rememberActivation(details);
    }
    const idChip = target.closest<HTMLElement>("button[data-copy-id]");
    if (idChip) {
      const id = idChip.dataset["copyId"] ?? "";
      if (id !== "") {
        copyText(doc, id);
        announce(`Copied ID ${id}`);
      }
      return;
    }
    if (handleBrowseControl(doc, target, diffs.update)) return;
    if (handleFrameClick(doc, target)) {
      event.preventDefault();
      return;
    }
    if (handleAddressClick(doc, target, (text) => copyText(doc, text))) {
      event.preventDefault();
      return;
    }
    const url = browseLinkTarget(event, target, win.location);
    if (!url) return;
    event.preventDefault();
    void navigate(url, true);
  });

  doc.addEventListener("keydown", (event) => {
    const target = event.target instanceof Element ? event.target : undefined;
    if (handleTagPickerKeydown(doc, event.key, target)) {
      event.preventDefault();
      return;
    }
    if (event.key === "Escape") collapseFrame(doc, expandedFrame(doc));
  });

  doc.addEventListener("input", (event) => {
    const target = event.target instanceof Element ? event.target : undefined;
    if (!target?.matches("[data-mokly-search]")) return;
    applyNavVisibility(doc, "reveal-matches");
    syncTagChips(doc);
  });

  doc.addEventListener(
    "toggle",
    (event) => {
      const target = event.target;
      if (
        target instanceof HTMLDetailsElement &&
        target.matches("[data-mokly-details]")
      ) {
        detailsPreference.remember(target.open);
      }
    },
    true,
  );

  win.addEventListener("popstate", (event) => {
    const state = event.state as ScrollState | null;
    const scrolls =
      state && typeof state.scrolls === "object" && state.scrolls !== null
        ? state.scrolls
        : undefined;
    if (isSameBrowseDocument(displayedUrl, new URL(win.location.href))) {
      sequencer.cancel();
      finishNavigation(doc);
      restoringHistory = false;
      if (scrolls) restoreRegionScrolls(doc, scrolls);
      return;
    }
    restoringHistory = true;
    void navigate(win.location.href, false, scrolls);
  });
  attachFrameNavigation(doc, frameActions);
  selectAndRevealRoute(
    doc,
    win.location.pathname,
    win.location.href,
    "navigation",
  );
  syncTagChips(doc);
  restoreEarlyDisclosures(doc);
}
