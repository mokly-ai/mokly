/**
 * Watched Serve's update status: the failure notice below the top bar, the
 * delayed progress slot beside search, and the compact bar spacing the
 * approved design draws. Concatenation preserves delivered bytes.
 */
export const SHELL_REBUILD_STATUS_CSS = `
/* ---- Update status ---------------------------------------------------- */

/* The notice spans the shell directly below the top bar and pushes the body
   down on every route. It is shell chrome, outside every preview frame. */
.mbk-rebuild {
  flex: none;
  padding: 8px 16px;
  border-bottom: 1px solid var(--chrome-border);
  background: var(--chrome-bg);
}

/* One full-surface treatment: a tinted fill inside a complete outline. The
   icon and the words carry the failure, so colour is never the only cue. */
.mbk-rebuild-card {
  position: relative;
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 9px 12px;
  border: 1px solid var(--mbk-danger-edge);
  border-radius: 8px;
  background: var(--mbk-danger-bg);
}

.mbk-rebuild-icon {
  display: inline-grid;
  place-items: center;
  flex: none;
  width: 16px;
  height: 20px;
  color: var(--mbk-danger-ink);
}

.mbk-rebuild-icon svg {
  display: block;
}

.mbk-rebuild-body {
  flex: 1;
  min-width: 0;
}

/* Wide shells keep the headline and explanation on one line and reserve the
   disclosure's room at the end of that line. */
.mbk-rebuild-copy {
  padding-right: 112px;
  color: var(--chrome-ink-2);
  font-size: 13px;
  line-height: 20px;
}

.mbk-rebuild-copy h2,
.mbk-rebuild-copy p {
  display: inline;
  margin: 0;
  font-size: 13px;
  line-height: 20px;
}

.mbk-rebuild-copy h2 {
  color: var(--chrome-ink);
  font-weight: 600;
}

/* The disclosure holds one place in both states, so opening it never moves
   the control that was just used. */
.mbk-rebuild-details > summary {
  position: absolute;
  top: 9px;
  right: 12px;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  border-radius: 4px;
  color: var(--mbk-danger-ink);
  font-size: 12px;
  font-weight: 600;
  line-height: 20px;
  list-style: none;
  cursor: pointer;
}

.mbk-rebuild-details > summary::-webkit-details-marker {
  display: none;
}

.mbk-rebuild-details > summary:hover {
  text-decoration: underline;
}

.mbk-rebuild-details > summary:focus-visible,
.mbk-rebuild-detail:focus-visible {
  outline: 2px solid var(--mbk-accent-deep);
  outline-offset: 2px;
}

.mbk-rebuild-details > summary svg {
  display: block;
  flex: none;
}

/* Both labels share one cell, so the control keeps its size in either state,
   and only the label naming what the disclosure offers is shown and named. */
.mbk-rebuild-label {
  display: inline-grid;
  justify-items: end;
}

.mbk-rebuild-label > span {
  grid-area: 1 / 1;
}

.mbk-rebuild-details[open] .mbk-rebuild-show,
.mbk-rebuild-details:not([open]) .mbk-rebuild-hide {
  visibility: hidden;
}

.mbk-rebuild-details[open] > summary svg {
  transform: rotate(180deg);
}

/* Developer detail: selectable text that keeps its line breaks, wraps long
   tokens instead of scrolling the page sideways, and scrolls within its
   bound as a focusable region the keyboard can reach. */
.mbk-rebuild-detail {
  max-height: 168px;
  margin: 8px 0 1px;
  padding: 8px 10px;
  overflow: auto;
  border: 1px solid var(--mbk-danger-edge);
  border-radius: 6px;
  background: var(--chrome-surface);
  color: var(--chrome-ink-2);
  font-family: var(--mono);
  font-size: 11.5px;
  line-height: 1.55;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

/* The search field and delayed progress share the field's flexible
   allotment, so progress narrows the field alone. Hidden progress takes no
   room and leaves no placeholder. */
.mbk-search-slot {
  display: flex;
  flex: 1;
  align-items: center;
  gap: inherit;
  min-width: 0;
  max-width: 440px;
}

.mbk-progress {
  display: inline-flex;
  flex: none;
  align-items: center;
  gap: 6px;
  height: 30px;
  color: var(--chrome-muted);
  font-size: 12px;
  font-weight: 500;
  white-space: nowrap;
}

.mbk-progress-spinner {
  flex: none;
  width: 12px;
  height: 12px;
  border: 1.5px solid var(--chrome-border);
  border-top-color: var(--chrome-muted);
  border-radius: 50%;
  animation: mbk-progress-spin 0.8s linear infinite;
}

@keyframes mbk-progress-spin {
  to {
    transform: rotate(360deg);
  }
}

/* Reduced motion keeps the same ring, text and geometry, without rotation. */
@media (prefers-reduced-motion: reduce) {
  .mbk-progress-spinner {
    animation: none;
  }
}

/* A compact standalone bar tightens its spacing as the design draws it, so
   the query stays readable beside the menu, brand, progress and Appearance.
   The notice keeps its words in the same order: the explanation wraps below
   the headline and the disclosure follows them. */
@media (max-width: 56.25rem) {
  .mbk-fs .mbk-topbar {
    gap: 10px;
    padding: 0 12px;
  }

  .mbk-rebuild {
    padding: 8px 12px;
  }

  .mbk-rebuild-copy {
    padding-right: 0;
  }

  .mbk-rebuild-copy h2,
  .mbk-rebuild-copy p {
    display: block;
  }

  .mbk-rebuild-details > summary {
    position: static;
    margin-top: 4px;
  }

  .mbk-rebuild-label {
    justify-items: start;
  }
}
`;
