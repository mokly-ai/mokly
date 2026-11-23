import { COMPONENT_ENTRIES } from "./metadata.js";

/**
 * Synthetic content of the Storybook stories scenario, never product data.
 * The Menu stories file holds two stories. Collapsed, the first one, renders
 * the parent's own page, and Expanded opens the list. On this branch the Menu
 * opens its list through a portal into `document.body`, so Expanded cannot
 * render on the server, and Mokly writes the error document in place of each
 * of its views. The branch point rendered the list in place.
 */

/** The Storybook story that could not render, by its Storybook name. */
const failedStory = COMPONENT_ENTRIES.menuExpanded.story;

/** Why the story could not render, as the server render reports it. */
const storyFailure = "document is not defined";

const menuLabel = "Options";

const menuItems = ["Rename", "Duplicate", "Archive"] as const;

/** The args of a Menu story: the button's label, and whether its list is open. */
export interface MenuArgs {
  label: string;
  open: boolean;
}

/** The args of the Collapsed story, or of the Expanded one. */
export function menuArgs(expanded: boolean): MenuArgs {
  return { label: menuLabel, open: expanded };
}

/**
 * The Menu as a story renders it: its button, and, when the story opens it,
 * the list below the button, as the branch point rendered Expanded.
 */
export function MenuExample({ expanded = false }: { expanded?: boolean }) {
  return (
    <div className="ce-menu">
      <button
        type="button"
        className="ce-menu-trigger"
        aria-expanded={expanded}
      >
        {menuLabel}
        <span aria-hidden="true">▾</span>
      </button>
      {expanded ? (
        <ul className="ce-menu-list">
          {menuItems.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

/**
 * The document that Mokly writes in place of each view of a story that could
 * not render. It names the story and says that it could not render, then
 * gives the tag that leaves the story out of the catalogue, and then the
 * reason, in a secondary place. It is a document of its own, so it starts
 * where the story would render, at the top left of the frame, unlike the
 * shell's own failure, which replaces the frame.
 */
export function StoryErrorDocument() {
  return (
    <div className="ce-story-error">
      <p className="ce-story-error-title">
        The {failedStory} story couldn’t render
      </p>
      <p>
        Add the <code className="ce-story-error-code">!mokly</code> tag to this
        story to leave it out of the catalogue.
      </p>
      <p className="ce-story-error-label">Reason</p>
      <code className="ce-story-error-reason">{storyFailure}</code>
    </div>
  );
}
