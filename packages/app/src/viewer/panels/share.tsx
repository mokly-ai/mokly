import type { Screen } from "../../api/types";
import { Action } from "../../components/action";
import { Pending, StateMessage } from "../../components/page-parts";
import { PaneResource } from "../../components/resource-state";
import { getShareLink, listScreens } from "../../data/publications";
import type { PagedItems } from "../../data/publications";
import { useResource } from "../../data/use-resource";
import type { Resource } from "../../data/use-resource";
import type { ViewerSelection } from "../host";
import { shareableScreens } from "../screens";
import type { SelectionDefaults } from "../selection";
import { shareLinkState } from "../share-state";

import { PanelList } from "./panel-rows";
import type { WaitingPanelRow } from "./panel-rows";
import { Link, LinkWait } from "./share-link";

/** The row the link points at, which says so and is no button. */
const chosen = { current: true, mark: "Selected" } as const;

/**
 * The screens while they are read: the whole catalogue keeps its known name,
 * one placeholder row stands for the screens, and which row is selected is
 * the read's, so no row is a button or says Selected yet.
 */
const waitingScreens: WaitingPanelRow[] = [
  { id: "whole-catalogue", waiting: true, title: "Whole catalogue" },
  { id: "waiting", waiting: true, title: "" },
];

function ScreenChoice({
  resource,
  selected,
  selection,
  onSelect,
  onRetry,
}: {
  resource: Resource<PagedItems<Screen>>;
  selected?: string;
  selection: ViewerSelection;
  onSelect: (screen?: string) => void;
  onRetry: () => void;
}) {
  return (
    <section className="fo-ref-group">
      <span className="fo-group-label">Screen</span>
      <PaneResource
        resource={resource}
        waiting={
          <Pending label="Loading screens" labelMode="screen-reader-only">
            <PanelList
              label="Screens in this publication"
              rows={waitingScreens}
            />
          </Pending>
        }
        failure="Screens couldn’t load"
        onRetry={onRetry}
      >
        {(all) => {
          // A link pins the screen and the way it is drawn together, so the
          // list holds the screens this publication draws in the reader's
          // view, with those the viewer shows through its light fallback under
          // Dark. Each other row is one button that selects it. The selected
          // screen comes from the same rule, and its row is no button: it
          // takes the signal-soft fill and says Selected.
          const items = shareableScreens(all.items, selection);
          return (
            <PanelList
              label="Screens in this publication"
              rows={[
                {
                  id: "whole-catalogue",
                  title: "Whole catalogue",
                  ...(selected === undefined
                    ? chosen
                    : { onChoose: () => onSelect(undefined) }),
                },
                ...items.map((screen) => ({
                  id: screen.path,
                  title: screen.title,
                  ...(selected === screen.path
                    ? chosen
                    : { onChoose: () => onSelect(screen.path) }),
                })),
              ]}
            />
          );
        }}
      </PaneResource>
    </section>
  );
}

/**
 * A reference with no publication has nothing to share yet. Only a reader who
 * administers the project is offered the way to publish, as on the stage.
 */
export function NoPublication({
  setUpPublishing,
}: {
  setUpPublishing?: string;
}) {
  return (
    <div className="fo-panel-stack">
      <StateMessage
        title="No publications yet"
        icon="branch"
        action={
          setUpPublishing ? (
            <Action
              label="Set up publishing"
              tone="primary"
              size="md"
              icon="external"
              href={setUpPublishing}
              testID="share-set-up-publishing"
            />
          ) : undefined
        }
      >
        A link points at one publication, so this branch needs one first.
      </StateMessage>
    </div>
  );
}

/**
 * The canonical link to what the reader is looking at. It pins one publication
 * and the selection that draws it; sharing grants nothing, so the panel says
 * who can already open it rather than offering to change that here.
 *
 * A publication with nothing to compare has no API screen selections to share, so
 * the screen choice is not offered and the publication's own link remains.
 *
 * The panel offers only a link for the current address. `shareLinkState`
 * decides when to request it, so the link area prepares while the address
 * resolves or while a named screen waits for the screen list.
 */
export function SharePanel({
  projectId,
  publicationId,
  visibility,
  selection,
  defaults,
  comparable,
  onSelectScreen,
  setUpPublishing,
}: {
  projectId: string;
  publicationId?: string;
  visibility: "private" | "public";
  selection: ViewerSelection;
  defaults: SelectionDefaults;
  comparable: boolean;
  onSelectScreen: (screen?: string) => void;
  /**
   * Where Set up publishing goes; absent for a reader who does not administer
   * the project, as on the stage.
   */
  setUpPublishing?: string;
}) {
  const screens = useResource(
    () =>
      publicationId === undefined
        ? Promise.reject(new Error("no publication"))
        : listScreens(projectId, publicationId),
    "viewer-screens:" + (publicationId ?? "none"),
    comparable && publicationId !== undefined,
  );
  const input = {
    walk: screens.state,
    selection,
    defaults,
    comparable,
    publicationId,
  };
  // The plan names the one link read. The second decision shows that read
  // only while it belongs to the current selection.
  const planned = shareLinkState(input);
  const link = useResource(
    () =>
      publicationId === undefined || planned.request === undefined
        ? Promise.reject(new Error("no link request"))
        : getShareLink(projectId, publicationId, planned.request.selection),
    planned.key,
    planned.request !== undefined,
    [],
    // The link for one key never changes, so enabling the same read again
    // keeps the held link. Try again still reads it again.
    { reloadOnEnable: false },
  );
  const sharing = shareLinkState(input, link);
  // A link points at one publication, so a reference that resolved with none
  // has nothing to share yet and says so rather than opening over an empty
  // body. While the address resolves, the link area prepares instead.
  if (sharing.empty) {
    return <NoPublication setUpPublishing={setUpPublishing} />;
  }
  return (
    <div className="fo-panel-stack">
      <PaneResource
        resource={sharing.visible}
        waiting={
          <Pending label="Preparing the publication link">
            {(name) => <LinkWait hold={name} visibility={visibility} />}
          </Pending>
        }
        failure="The link couldn’t be prepared"
        onRetry={link.reload}
      >
        {(value) => <Link link={value} visibility={visibility} />}
      </PaneResource>
      {comparable && (
        <ScreenChoice
          resource={screens.state}
          selected={sharing.screen}
          selection={selection}
          onSelect={onSelectScreen}
          onRetry={screens.reload}
        />
      )}
    </div>
  );
}
