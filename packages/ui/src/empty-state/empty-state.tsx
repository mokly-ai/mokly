/**
 * The quiet state of a stage that has no preview to show, and the states of
 * the shell that use it: the catalogue home, a route that matches no entry,
 * and a removed entry. A state can be busy while it loads, or an alert after
 * a failure, and its action is a link or a button. A state can also take the
 * place of a whole viewer root that has no shell to show.
 */

import type { ReactNode, Ref } from "react";

import type { Appearance } from "../appearance-selector/appearance-selector.js";
import type { DataAttribute } from "../segmented-control/segmented-control.js";

/**
 * The viewer root that a state takes the place of: the standalone shell's
 * root, or an embedded root, which states its appearance.
 */
export type EmptyStateRoot =
  { kind: "standalone" } | { kind: "embedded"; theme: Appearance };

/** The class that each root carries before the state's own class. */
const ROOT_CLASS = { embedded: "mokly-viewer", standalone: "mbk" } as const;

/** An action that goes to another page. */
export interface EmptyStateLink {
  href: string;
  label: string;
}

/** An action that the host performs, such as Try again. */
export interface EmptyStateButton {
  label: string;
  /** An empty data attribute on the button, such as `data-diff-refresh`. */
  mark?: DataAttribute | undefined;
  /** Receives each press. */
  onClick?: (() => void) | undefined;
}

/** The action of an empty state. */
export type EmptyStateAction = EmptyStateLink | EmptyStateButton;

/** The empty data attribute that names an element, when there is one. */
function dataMark(mark: DataAttribute | undefined) {
  return mark === undefined ? {} : { [mark]: "" };
}

/**
 * The action of an empty state, as a link or a button. It can also stand
 * inline in another line, such as the Try again of a failed comparison.
 */
export function EmptyAction({ action }: { action: EmptyStateAction }) {
  if ("href" in action)
    return (
      <a className="mbk-empty-link" href={action.href}>
        {action.label}
      </a>
    );
  return (
    <button
      className="mbk-empty-link"
      {...dataMark(action.mark)}
      onClick={() => action.onClick?.()}
      type="button"
    >
      {action.label}
    </button>
  );
}

/**
 * The empty state: an optional title, the body with an optional code chip,
 * a quieter note, and an action. A busy state announces its body as a status.
 */
export function EmptyState({
  action,
  body,
  busy = false,
  children,
  code,
  focusRef,
  mark,
  note,
  role,
  root,
  stage = false,
  title,
}: {
  action?: EmptyStateAction | undefined;
  /** The first line, such as why the stage is empty. */
  body?: string | undefined;
  /** Whether the state waits for its data, which marks it busy. */
  busy?: boolean;
  /** A message without a paragraph of its own, after the other lines. */
  children?: ReactNode;
  /** The code after the body, such as the path that matches no entry. */
  code?: string | undefined;
  /**
   * Receives the state's element, which can then take focus, such as a
   * loading state that the host focuses after Try again.
   */
  focusRef?: Ref<HTMLDivElement> | undefined;
  /** An empty data attribute on the state, such as `data-workspace-empty`. */
  mark?: DataAttribute | undefined;
  /** A quieter line after the body, such as what the catalogue holds. */
  note?: string | undefined;
  /** `alert` for a failure that the reader hears at once. */
  role?: "alert" | undefined;
  /** The viewer root that the state takes the place of, if any. */
  root?: EmptyStateRoot | undefined;
  /**
   * Whether the state takes the place of the routed stage, which marks it
   * `data-mokly-stage` for both viewports.
   */
  stage?: boolean;
  title?: string | undefined;
}) {
  return (
    <div
      aria-busy={busy ? "true" : undefined}
      className={
        root === undefined ? "mbk-empty" : `${ROOT_CLASS[root.kind]} mbk-empty`
      }
      {...(stage ? { "data-mokly-stage": "", "data-viewport": "both" } : {})}
      {...dataMark(mark)}
      ref={focusRef}
      role={role}
      tabIndex={focusRef === undefined ? undefined : -1}
      {...(root?.kind === "embedded" ? { "data-mokly-theme": root.theme } : {})}
    >
      {title === undefined ? null : <h2>{title}</h2>}
      {body === undefined && code === undefined ? null : (
        <p role={busy ? "status" : undefined}>
          {code === undefined ? body : `${body ?? ""} `}
          {code === undefined ? null : <code>{code}</code>}
        </p>
      )}
      {note === undefined ? null : <p className="mbk-empty-note">{note}</p>}
      {action === undefined ? null : <EmptyAction action={action} />}
      {children}
    </div>
  );
}

/**
 * A one-line empty state in the place of content, such as a frame without a
 * document.
 */
export function EmptyLine({ children }: { children: ReactNode }) {
  return <p className="mbk-empty">{children}</p>;
}

/** The catalogue home: how to browse it, and what it holds. */
export function HomeState({
  summary,
}: {
  /** What the catalogue holds, such as "3 screens · 2 components". */
  summary?: string | undefined;
}) {
  return (
    <EmptyState
      body="Browse the mockup catalogue: expand folders and choose an item from the navigation."
      note={summary ? summary : undefined}
      title="Mokly"
    />
  );
}

/** A route that matches no entry: the requested path, and a link home. */
export function MissingRouteState({ requested }: { requested: string }) {
  return (
    <EmptyState
      action={{ href: "/", label: "Go to the catalogue home" }}
      body="Nothing in the catalogue matches"
      code={requested}
      title="Item not found"
    />
  );
}

/** What a removed entry's stage says, by the kind of the entry. */
const REMOVED = {
  component: [
    "This component was removed",
    "Select a comparison to see the previous version.",
  ],
  flow: [
    "This user flow was removed",
    "This flow is no longer in the catalogue.",
  ],
  screen: ["This screen was removed", "There is no current preview to show."],
  variant: [
    "This variant was removed",
    "Select a comparison to see the previous version.",
  ],
} as const;

/**
 * The stage of a removed entry that shows no previous version. A removed
 * variant names itself, never its surviving parent.
 */
export function RemovedState({ kind }: { kind: keyof typeof REMOVED }) {
  const [title, body] = REMOVED[kind];
  return <EmptyState body={body} stage title={title} />;
}

/** The stage of a component whose selected variant was removed. */
export function RemovedVariantState() {
  return (
    <EmptyState
      body="This variant was removed. Select a comparison to see its previous version."
      mark="data-workspace-empty"
      stage
    />
  );
}
