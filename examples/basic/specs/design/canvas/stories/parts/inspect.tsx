import { UsageList } from "../../../../../../../packages/ui/src/usage-list/usage-list.js";
import { CanvasGlyph } from "../../../library/canvas/glyphs.js";
import { MetaRow } from "../../../parts/metadata_row.js";
import {
  ChooseVariant,
  VariantControls,
  type VariantField,
} from "../../parts/component_props.js";
import type { CanvasFrameSpec } from "../../parts/frames.js";
import {
  InspectFold,
  InspectFrames,
  InspectHead,
  InspectSelection,
} from "../../parts/inspect.js";
import { InspectFrameSelected } from "../../parts/inspect_selection.js";
import { SET_FILTER } from "../../parts/inspect_sets.js";
import { InspectVariants } from "../../parts/inspect_variants.js";

import { MENU, MENU_STORIES, type MenuStory } from "./branch.js";
import { STORY_PAGES as S, type StoryDestination } from "./destinations.js";

/**
 * The link to the shown story in the published Storybook. The product link
 * opens the story's own address in a new tab, so its icon and its
 * screen-reader label say so. A design link opens a design entry, so the
 * artboard draws the link as a picture: an anchor without an address, which
 * the metadata column styles as a link, and which opens nothing and adds no
 * keyboard stop.
 */
function StorybookLink() {
  return (
    <a className="mbk-meta-link mbk-reset cv-external-link">
      Open in Storybook
      <CanvasGlyph name="external" size={12} />
      <span className="cv-visually-hidden"> (opens in a new tab)</span>
    </a>
  );
}

/**
 * The head of a Menu story's Inspect: the Menu's description, the shown
 * entry's path and the stories file, then the Story row, which names the
 * story that the page renders, then the Storybook link, which the page of
 * an added story leaves out, because the published Storybook does not hold
 * that story yet, and the schemes. The stories file declares no tags.
 */
export function StoryHead({ story }: { story: MenuStory }) {
  return (
    <InspectHead
      description={MENU.description}
      entry={story.entry}
      rows={
        <>
          <MetaRow name="story" label="Story">
            {story.story}
          </MetaRow>
          {story.storybook ? (
            <MetaRow name="storybook" label="Storybook">
              <StorybookLink />
            </MetaRow>
          ) : null}
          <MetaRow name="schemes" label="Schemes">
            light, dark
          </MetaRow>
        </>
      }
      source={MENU.source}
    />
  );
}

/** The args of a Menu story, which its data args make into fields. */
interface MenuArgs {
  label: string;
  open: boolean;
  disabled?: boolean | undefined;
}

/** Each story's args, as the stories file declares them. */
const MENU_ARGS: Readonly<Record<MenuStory["slug"], MenuArgs>> = {
  menu: { label: "Options", open: false },
  expanded: { label: "Options", open: true },
  disabled: { label: "Options", open: false, disabled: true },
};

/**
 * The fields that Mokly derives from a Menu story's data args: a text field
 * for the label, a toggle for `open`, and an optional toggle for
 * `disabled`, which the Menu's argTypes declare.
 */
function menuFields(args: MenuArgs): readonly VariantField[] {
  return [
    {
      name: "label",
      label: "label",
      input: (id) => <input defaultValue={args.label} id={id} type="text" />,
    },
    {
      name: "open",
      label: "open",
      input: (id) => (
        <input defaultChecked={args.open} id={id} type="checkbox" />
      ),
    },
    {
      name: "disabled",
      label: "disabled",
      optional: true,
      unset: args.disabled === undefined,
      input: (id) => (
        <input
          defaultChecked={args.disabled ?? false}
          id={id}
          type="checkbox"
        />
      ),
    },
  ];
}

/**
 * Inspect for the Menu's variant set: the shown story's head, the three
 * stories, the six frames, and the selected frame. With a story's frame
 * selected, Props edits that story's args in place, as for any entry with
 * controls; with none, Props asks for a variant. No screen uses the Menu, so
 * Usage lists no consumers. A failed story's views render no registered
 * component, and the Menu renders none either, so Highlight components is
 * unavailable. The panel opens at its head, so the Story and Storybook rows
 * show beside the selected frame.
 */
export function MenuInspect({
  frame,
  story,
}: {
  /** The selected frame, the shown story's Light frame on a desktop. */
  frame?: CanvasFrameSpec | undefined;
  story: MenuStory;
}) {
  const fields = menuFields(MENU_ARGS[story.slug]);
  const variant = (shown: MenuStory, to: StoryDestination) => ({
    label: shown.title,
    current: shown.slug === story.slug,
    to,
  });
  return (
    <>
      <StoryHead story={story} />
      <InspectVariants
        variants={[
          variant(MENU_STORIES.menu, S.storybookLink),
          variant(MENU_STORIES.expanded, S.storyFailed),
          variant(MENU_STORIES.disabled, S.storyAdded),
        ]}
      />
      <InspectFrames
        count={6}
        filter={{ ...SET_FILTER, unavailable: "empty" }}
      />
      {frame === undefined ? (
        <InspectSelection />
      ) : (
        <InspectFrameSelected frame={frame} variant={story.title} />
      )}
      <InspectFold
        count={frame === undefined ? undefined : fields.length}
        name="props"
        open={frame !== undefined}
        title="Props"
      >
        {frame === undefined ? (
          <ChooseVariant />
        ) : (
          <VariantControls
            fields={fields}
            id={`menu-${story.slug}`}
            title={story.title}
          />
        )}
      </InspectFold>
      <InspectFold count={0} name="usage" title="Usage">
        <UsageList affected={[]} usedBy={[]} />
      </InspectFold>
    </>
  );
}
