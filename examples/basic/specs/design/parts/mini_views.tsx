import type { ReactNode } from "react";

import type {
  DepictedView,
  HighlightRegion,
  PreviewRegions,
} from "./depicted_view.js";
import type { ArtboardViewport } from "./shell.js";

/** A depicted form of the example's Welcome or Details screen. */
export type MiniForm =
  "details" | "welcome" | "welcome-empty" | "welcome-error";

/** The Action that a form's real screen renders as its own instance. */
interface MiniAction {
  id: string;
  label: string;
  tone: "disabled" | "primary" | "secondary";
  /** Its fixed width, which the label never changes. */
  width: number;
}

/** The Toolbar that a form's real screen renders, with its slot's text. */
interface MiniToolbar {
  text: string;
  title: string;
}

const WELCOME = {
  action: { id: "details", label: "View details", tone: "primary", width: 112 },
  toolbar: { text: "Explore the catalogue.", title: "Workspace actions" },
} as const;

/**
 * The instances that each form's real screen in
 * `examples/basic/specs/catalogue.tsx` owns: its Action and its Toolbar. The
 * empty workspace has no Toolbar, and its Action waits for a name.
 */
const INSTANCES: Record<
  MiniForm,
  { action: MiniAction; toolbar?: MiniToolbar | undefined }
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
  "welcome-empty": {
    action: {
      id: "create-workspace",
      label: "Create workspace",
      tone: "disabled",
      width: 140,
    },
  },
  "welcome-error": WELCOME,
};

/** The left edge of a mini screen's content, its padding. */
const LEFT = 20;

/**
 * The fixed rows of a mini screen above its instances, each with its gap, as
 * `design-shots.css` draws them: the padding, the navigation, the heading, the
 * empty workspace's field, the save error, and Details' text. The error and
 * the text take one line on a desktop and two in a phone.
 */
const ROWS = {
  pad: 18,
  nav: 28.25 + 14,
  title: 25.5 + 10,
  field: 32 + 10,
  error: { desktop: 37.375 + 12, mobile: 56.75 + 12 },
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
    case "welcome-empty":
      return top + ROWS.nav + ROWS.field;
    case "welcome-error":
      return top + ROWS.nav + ROWS.error[viewport];
  }
}

function formRegions(
  form: MiniForm,
  viewport: ArtboardViewport,
): PreviewRegions {
  const { action, toolbar } = INSTANCES[form];
  const y = actionTop(form, viewport);
  const own: HighlightRegion = {
    box: { x: LEFT, y, width: action.width, height: ACTION_ROW.height },
    label: `Action · ${action.id}`,
  };
  if (toolbar === undefined) return [own];
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
      {toolbar === undefined ? null : (
        <div className="mbk-shot-toolbar">
          <strong>{toolbar.title}</strong>
          <span>{toolbar.text}</span>
          <div className="mbk-shot-toolbar-actions">
            <span className="mbk-shot-action mbk-shot-action--primary">
              Browse details
            </span>
            <span className="mbk-shot-action mbk-shot-action--secondary">
              Browse welcome
            </span>
          </div>
        </div>
      )}
    </>
  );
}
