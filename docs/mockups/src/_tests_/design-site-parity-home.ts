/**
 * The recorded parity differences of the home area: the hero, the features
 * intro and modules, the depicted Mokly viewer, the Review and Edit frames
 * with their thread and chat, and the open foundation with its steps.
 * `design-site-parity.test.ts` merges this list with the lists of the other
 * areas. Each key is a selector that the mockup sheets and the site sheets
 * both declare with different values; each value says why, and which
 * milestone of the Canvas redesign plan removes the difference.
 */

const HERO =
  "Canvas home: Design in code. is a selected text layer at 162px with the lead and both actions under it, on the canvas; Milestone 5 rebuilds the home";
const FEATURES =
  "Canvas home: the features intro and the Browse, Review and Edit frames, each with its copy and a labelled frame on the canvas; Milestone 5 rebuilds the home";
const VIEWER =
  "Canvas home: Browse depicts the Mokly viewer on acme/storefront's branch, with the All and Changes filter, the catalogue rows and the Swipe compare; Milestone 5 rebuilds the home";
const REVIEW =
  "Canvas home: Review pins the comment thread to the selected PriceCard of the drawn pricing screen, with Approve; Milestone 5 rebuilds the home";
const EDIT =
  "Canvas home: Edit is one tool window with the pricing artboard and the Claude chat docked beside it; Milestone 5 rebuilds the home";
const FOUNDATION =
  "Canvas home: the open foundation wires its source to the rendered artboard and draws the steps as a flow of frames; Milestone 5 rebuilds the home";

export const HOME_DIFFERENCES: Readonly<Record<string, string>> = {
  ".site-actions": HERO,
  ".site-hero": HERO,
  ".site-hero .site-actions": HERO,
  ".site-hero h1": HERO,
  ".site-hero-lead": HERO,
  ".site-module": FEATURES,
  ".site-module h3": FEATURES,
  ".site-module-body": FEATURES,
  ".site-module-detail": FEATURES,
  ".site-module-grid": FEATURES,
  ".site-modules": FEATURES,
  ".site-section-head": FEATURES,
  ".site-section-head h2": FEATURES,
  ".site-section-head p": FEATURES,
  ".site-crumb": VIEWER,
  ".site-crumb-sep": VIEWER,
  ".site-crumbs": VIEWER,
  ".site-filter": VIEWER,
  ".site-filter-count": VIEWER,
  ".site-filter-option": VIEWER,
  ".site-filter-option--current": VIEWER,
  ".site-frame": VIEWER,
  ".site-idchip": VIEWER,
  ".site-row": VIEWER,
  ".site-row--current": VIEWER,
  ".site-row--current .site-row-ico": VIEWER,
  ".site-row--group .site-row-label": VIEWER,
  ".site-row-ico": VIEWER,
  '.site-row[data-site-depth="1"]': VIEWER,
  '.site-row[data-site-depth="2"]': VIEWER,
  ".site-screen-head": VIEWER,
  ".site-screen-title": VIEWER,
  ".site-screen-title-row": VIEWER,
  ".site-shell-body": VIEWER,
  ".site-shell-main": VIEWER,
  ".site-stage": VIEWER,
  ".site-stage-frame": VIEWER,
  ".site-stage-label": VIEWER,
  ".site-stage-screen": VIEWER,
  ".site-topbar": VIEWER,
  ".site-topbar-mark": VIEWER,
  ".site-tree": VIEWER,
  ".site-tree-chevron": VIEWER,
  ".site-tree-scroll": VIEWER,
  ".site-tree-section-head": VIEWER,
  ".site-comment": REVIEW,
  ".site-comment-approve": REVIEW,
  ".site-comment-head": REVIEW,
  ".site-detail": REVIEW,
  ".site-pin": REVIEW,
  ".site-agent": EDIT,
  ".site-agent-input": EDIT,
  ".site-agent-send": EDIT,
  ".site-agent-turn": EDIT,
  ".site-agent-turn--reply": EDIT,
  ".site-detail--split": EDIT,
  ".site-closing": FOUNDATION,
  ".site-closing-copy h2": FOUNDATION,
  ".site-closing-copy p": FOUNDATION,
  ".site-closing-panel": FOUNDATION,
  ".site-step": FOUNDATION,
  ".site-step h3": FOUNDATION,
  ".site-step p": FOUNDATION,
  ".site-step-number": FOUNDATION,
  ".site-steps": FOUNDATION,
};
