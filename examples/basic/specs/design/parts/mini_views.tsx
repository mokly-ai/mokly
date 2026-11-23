import type { ReactNode } from "react";

import type { ArtboardViewport } from "./artboards.js";
import type {
  DepictedView,
  HighlightRegion,
  PreviewRegions,
} from "./depicted_view.js";
import { labelBox } from "./mini_action.js";

/**
 * A depicted form of the example's Welcome or Details screen. The revised
 * Welcome adds its one-line introduction below the heading.
 */
export type MiniForm = "details" | "welcome" | "welcome-revised";

/** The Action that a form's real screen renders as its own instance. */
interface MiniAction {
  id: string;
  label: string;
  tone: "primary" | "secondary";
  /** Its fixed width, which the label never changes. */
  width: number;
}

/** The Toolbar that a form's real screen renders, with its slot's text. */
export interface MiniToolbarContent {
  text: string;
  title: string;
}

const WELCOME = {
  action: { id: "details", label: "View details", tone: "primary", width: 112 },
  toolbar: { text: "Explore the catalogue.", title: "Workspace actions" },
} as const;

/**
 * The instances that each form's real screen in
 * `examples/basic/specs/catalogue.tsx` owns: its Action and its Toolbar.
 */
const INSTANCES: Record<
  MiniForm,
  { action: MiniAction; toolbar: MiniToolbarContent }
> = {
  details: {
    action: {
      id: "welcome",
      label: "Return to welcome",
      tone: "secondary",
      width: 148,
    },
    toolbar: {
      text: "Browse the connected screens.",
      title: "Catalogue actions",
    },
  },
  welcome: WELCOME,
  "welcome-revised": WELCOME,
};

/** The left edge of a mini screen's content, its padding. */
const LEFT = 20;

/**
 * The fixed rows of a mini screen above its instances, each with its gap, as
 * `design-shots.css` draws them: the padding, the navigation, the heading, the
 * revised Welcome's introduction, and Details' text. The introduction takes
 * one line in both viewports; the text takes one line on a desktop and two in
 * a phone.
 */
const ROWS = {
  pad: 18,
  nav: 28.25 + 14,
  title: 25.5 + 10,
  intro: 19.375 + 12,
  text: { desktop: 19.375 + 12, mobile: 38.75 + 12 },
} as const;

/** The Action's row with its gap, and the link's row with its gap. */
const ACTION_ROW = { height: 30, gap: 10 };
const LINK_ROW = 20 + 12;

/** The Toolbar keeps its actions in a row on a desktop, and stacks them in a phone. */
const TOOLBAR_HEIGHT = { desktop: 96, mobile: 128 } as const;

function actionTop(form: MiniForm, viewport: ArtboardViewport): number {
  const top = ROWS.pad + ROWS.title;
  switch (form) {
    case "details":
      return top + ROWS.text[viewport];
    case "welcome":
      return top + ROWS.nav;
    case "welcome-revised":
      return top + ROWS.nav + ROWS.intro;
  }
}

function formRegions(
  form: MiniForm,
  viewport: ArtboardViewport,
): PreviewRegions {
  const { action } = INSTANCES[form];
  const y = actionTop(form, viewport);
  const own: HighlightRegion = {
    box: { x: LEFT, y, width: action.width, height: ACTION_ROW.height },
    label: `Action · ${action.id}`,
  };
  return [
    own,
    {
      box: {
        x: LEFT,
        y: y + ACTION_ROW.height + ACTION_ROW.gap + LINK_ROW,
        width: `calc(100% - ${2 * LEFT}px)`,
        height: TOOLBAR_HEIGHT[viewport],
      },
      label: "Toolbar · toolbar",
    },
  ];
}

/**
 * The depicted view of a form's screen in Browse and Changes: the shell can
 * highlight it, and its preview highlights the form's own instances.
 */
export function miniView(form: MiniForm): DepictedView {
  return {
    highlight: "available",
    regions: {
      desktop: formRegions(form, "desktop"),
      mobile: formRegions(form, "mobile"),
    },
  };
}

/**
 * A form's own instances in the mini screen: its Action, the screen's link,
 * and its Toolbar with the Toolbar's two Actions. Each row keeps a fixed
 * height, so the instances lie at the boxes of their regions.
 */
export function MiniInstances({
  form,
  link,
}: {
  form: MiniForm;
  link: ReactNode;
}) {
  const { action, toolbar } = INSTANCES[form];
  return (
    <>
      <span
        className={`mbk-shot-action mbk-shot-action--${action.tone} mbk-shot-own-action`}
        style={{ width: action.width }}
      >
        {action.label}
      </span>
      <div className="mbk-shot-link-row">{link}</div>
      <MiniToolbarCard {...toolbar} />
    </>
  );
}

/** The two Actions that the example's Toolbar renders, by their labels. */
const TOOLBAR_ACTIONS = [
  { label: "Browse details", tone: "primary" },
  { label: "Browse welcome", tone: "secondary" },
] as const;

/**
 * A depicted Toolbar: its title, its slot's text where the caller fills the
 * slot, and the two Actions that the example's Toolbar renders, in a row on
 * a desktop and in a component document, and stacked in a phone. In a
 * component document, each Action's label keeps its measured width.
 */
export function MiniToolbarCard({
  measured = false,
  text,
  title,
}: {
  /** The card stands in its component document, at the measured layout. */
  measured?: boolean | undefined;
  text?: string | undefined;
  title: string;
}) {
  return (
    <div className="mbk-shot-toolbar">
      <strong>{title}</strong>
      {text === undefined ? null : <span>{text}</span>}
      <div className="mbk-shot-toolbar-actions">
        {TOOLBAR_ACTIONS.map(({ label, tone }) => (
          <span
            className={`mbk-shot-action mbk-shot-action--${tone}`}
            key={label}
            style={measured ? labelBox(label) : undefined}
          >
            {label}
          </span>
        ))}
      </div>
    </div>
  );
}
