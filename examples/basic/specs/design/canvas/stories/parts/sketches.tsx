import type { ReactNode } from "react";

import { sidePairs } from "../../components/parts/sketches.js";
import { componentFrames, type CanvasFrameSpec } from "../../parts/frames.js";
import type { SetFit } from "../../parts/sketches.js";

import { MENU_STORIES } from "./branch.js";

/** Why the Expanded story could not render, as the server render reports it. */
export const STORY_FAILURE = "document is not defined";

/** The button's label in every Menu story. */
const MENU_LABEL = "Options";

/** The actions of the Menu's list. */
const MENU_ITEMS = ["Rename", "Duplicate", "Archive"] as const;

/**
 * The size of each document that the Menu's frames hold, as a build of the
 * branch would measure it in its desktop view, in CSS pixels: the closed
 * Menu, the error document in place of Expanded, Expanded as the branch
 * point rendered it, and the disabled Menu. Light and dark measure the same.
 */
export const MENU_DOCUMENTS = {
  menu: { width: 140, height: 84 },
  expanded: { width: 360, height: 192 },
  expandedBefore: { width: 180, height: 192 },
  disabled: { width: 140, height: 84 },
} as const;

/**
 * The zooms that fit the Menu's variant set, whose widest frame holds the
 * error document, and the pair of Expanded · Light in Side by side.
 */
export const MENU_FITS = {
  set: { zoom: 100, phoneSet: 44, phonePicked: 100 },
  pair: { zoom: 100, phone: 48 },
} as const satisfies { set: SetFit; pair: { zoom: number; phone: number } };

/**
 * The Menu as a story renders it: its button, and, when the story opens it,
 * the list below the button, as the branch point rendered Expanded.
 */
export function MenuExample({
  disabled = false,
  open = false,
}: {
  disabled?: boolean;
  open?: boolean;
}) {
  return (
    <div className="cv-menu">
      <span
        className={`cv-menu-trigger${disabled ? " cv-menu-trigger--disabled" : ""}`}
      >
        {MENU_LABEL}
        <span aria-hidden="true">▾</span>
      </span>
      {open ? (
        <ul className="cv-menu-list">
          {MENU_ITEMS.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

/**
 * The document that Mokly writes in place of each view of a story that
 * could not render. It names the story and says that it could not render,
 * gives the tag that leaves the story out of the catalogue, and gives the
 * reason last, in a secondary place. It carries only its own styles, with
 * system colours, so it follows the scheme of its view: light in a Light
 * frame and dark in a Dark one. It starts where the story would render, at
 * the top left of the frame.
 */
export function StoryErrorDocument() {
  return (
    <div className="cv-story-error">
      <p className="cv-story-error-title">
        The {MENU_STORIES.expanded.story} story couldn’t render
      </p>
      <p>
        Add the <code>!mokly</code> tag to this story to leave it out of the
        catalogue.
      </p>
      <p className="cv-story-error-label">Reason</p>
      <code className="cv-story-error-reason">{STORY_FAILURE}</code>
    </div>
  );
}

/** One row of the Menu's set: its story's sketch, with its document's size. */
function row(
  slug: string,
  title: string,
  size: { width: number; height: number },
  render: () => ReactNode,
) {
  return { slug, title, size, render };
}

/**
 * The Menu's variant set on the stories branch: Collapsed's row, which the
 * component's title names, then Expanded's, whose frames hold the error
 * document, then the added Disabled's.
 */
export function menuSetFrames(): CanvasFrameSpec[] {
  return componentFrames([
    row(
      MENU_STORIES.menu.slug,
      MENU_STORIES.menu.title,
      MENU_DOCUMENTS.menu,
      () => <MenuExample />,
    ),
    row(
      MENU_STORIES.expanded.slug,
      MENU_STORIES.expanded.title,
      MENU_DOCUMENTS.expanded,
      () => <StoryErrorDocument />,
    ),
    row(
      MENU_STORIES.disabled.slug,
      MENU_STORIES.disabled.title,
      MENU_DOCUMENTS.disabled,
      () => <MenuExample disabled />,
    ),
  ]);
}

/** Expanded's two frames, which its comparison compares. */
export function expandedFrames(): CanvasFrameSpec[] {
  return menuSetFrames().filter(
    (frame) => frame.variant === MENU_STORIES.expanded.slug,
  );
}

/**
 * Expanded in Side by side: in each of its frames, its last render on the
 * branch point, with the list open, beside the error document. Both sides
 * share the frame's size, the larger of the two.
 */
export function expandedSideFrames(): CanvasFrameSpec[] {
  return sidePairs(expandedFrames(), () => <MenuExample open />);
}
