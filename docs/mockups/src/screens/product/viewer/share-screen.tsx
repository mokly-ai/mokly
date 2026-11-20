import type { ColorScheme, Viewport } from "@mokly/mokly";

import type { ScreenState } from "../../../fixtures/product-states";
import { failureReference } from "../../../fixtures/product-states";
import {
  listedScreens,
  publicationLink,
  shareSelection,
} from "../../../fixtures/publication-screens";
import type { PublicationScreen } from "../../../fixtures/publication-screens";
import { useMockupRenderContext } from "../../../render-context";
import { Action, Pending, StateMessage } from "../page-parts";

import { PanelList } from "./panel-rows";
import { ViewerPanelScreen } from "./screen";
import { ShareLink } from "./share-link";

const title = "Share";

/** One screen that a link can open, with the scheme of the view it opens. */
interface ScreenOffer {
  screen: PublicationScreen;
  scheme: ColorScheme;
}

/**
 * The current screens that a link can open from the reader's view. A link
 * pins the screen, the viewport and the scheme together, so a screen that the
 * publication does not draw at the viewport is left out. Under Dark, a screen
 * with no dark view at the viewport stays: the viewer shows its light view,
 * the light fallback, and its link opens that light view.
 */
function screenOffers(viewport: Viewport, scheme: ColorScheme): ScreenOffer[] {
  return listedScreens.flatMap((screen): ScreenOffer[] => {
    const drawn = (wanted: ColorScheme) =>
      screen.views.some(
        (view) => view.viewport === viewport && view.scheme === wanted,
      );
    if (drawn(scheme)) return [{ screen, scheme }];
    return scheme === "dark" && drawn("light")
      ? [{ screen, scheme: "light" }]
      : [];
  });
}

/** The row control that selects a screen, or the whole catalogue. */
const choose = {
  to: "product/viewer/share",
  action: "Select",
  choose: true,
} as const;

/** The row that the link points at, which says so in place of its choice. */
const chosen = { current: true, mark: "Selected" } as const;

/**
 * Which screen the link points at: the whole catalogue or one offer. The
 * selected row takes the signal-soft fill and says Selected in place of its
 * choice. While the screens are read, the whole catalogue keeps its known
 * name, one placeholder row stands for the screens, and which row is
 * selected is the read's, so each row's choice is a placeholder.
 */
function ScreenChoice({
  offers,
  selected,
  waiting = false,
}: {
  offers: readonly ScreenOffer[];
  selected?: ScreenOffer;
  waiting?: boolean;
}) {
  const list = (
    <PanelList
      label="Screens in this publication"
      rows={
        waiting
          ? [
              {
                id: "whole-catalogue",
                title: "Whole catalogue",
                ...choose,
                waiting: true,
              },
              { id: "waiting", title: "", ...choose, waiting: true },
            ]
          : [
              {
                id: "whole-catalogue",
                title: "Whole catalogue",
                ...(selected === undefined ? chosen : choose),
              },
              ...offers.map(({ screen }) => ({
                id: screen.id,
                title: screen.title,
                ...(screen === selected?.screen ? chosen : choose),
              })),
            ]
      }
    />
  );
  return (
    <section className="fo-ref-group">
      <span className="fo-group-label">Screen</span>
      {waiting ? (
        <Pending label="Loading screens" labelMode="screen-reader-only">
          {list}
        </Pending>
      ) : (
        list
      )}
    </section>
  );
}

function SharePage({
  state,
  viewport,
  screen,
  screens = true,
}: {
  state: ScreenState;
  viewport: Viewport;
  screen?: string;
  /** A publication with nothing to compare has no screens to choose from. */
  screens?: boolean;
}) {
  const { colorScheme } = useMockupRenderContext();
  const offers = screens ? screenOffers(viewport, colorScheme) : [];
  const selected = offers.find(
    (offer) => offer.screen.id === shareSelection.screen,
  );
  // The address leaves out the desktop viewport and the reader's own scheme,
  // and so does the link. Only a screen that the light fallback shows names
  // its scheme, so that the link opens the view the reader sees.
  const link = publicationLink({
    screen: selected?.screen.id,
    viewport: viewport === "mobile" ? viewport : undefined,
    scheme: selected?.scheme === colorScheme ? undefined : selected?.scheme,
  });
  return (
    <ViewerPanelScreen
      id="product/viewer/share"
      state={state}
      viewport={viewport}
      title={title}
      close="product/viewer/standalone"
      screen={screen}
    >
      <div className="fo-panel-stack">
        {state === "empty" ? (
          <StateMessage
            title="No publications yet"
            icon="branch"
            action={
              <Action
                instance="share-set-up-publishing"
                label="Set up publishing"
                to="product/account/project-created"
                tone="primary"
                size="md"
                icon="external"
              />
            }
          >
            A link points at one publication, so this branch needs one first.
          </StateMessage>
        ) : (
          <>
            {state === "loading" ? (
              <Pending label="Preparing the publication link">
                {(name) => <ShareLink hold={name} />}
              </Pending>
            ) : state === "error" ? (
              <StateMessage
                title="The link couldn’t be prepared"
                error
                reference={failureReference}
                action={
                  <Action
                    instance="share-retry"
                    label="Try again"
                    to="product/viewer/share"
                    tone="primary"
                    size="md"
                    icon="retry"
                  />
                }
              />
            ) : (
              <ShareLink link={link} />
            )}
            {screens && (
              <ScreenChoice
                offers={offers}
                selected={selected}
                waiting={state === "loading"}
              />
            )}
          </>
        )}
      </div>
    </ViewerPanelScreen>
  );
}

export function ViewerShareScreen({ viewport }: { viewport: Viewport }) {
  return <SharePage viewport={viewport} state="default" />;
}

export function ViewerShareEmptyScreen({ viewport }: { viewport: Viewport }) {
  return <SharePage viewport={viewport} state="empty" />;
}

export function ViewerShareLoadingScreen({ viewport }: { viewport: Viewport }) {
  return <SharePage viewport={viewport} state="loading" />;
}

export function ViewerShareErrorScreen({ viewport }: { viewport: Viewport }) {
  return <SharePage viewport={viewport} state="error" />;
}

/**
 * A publication with nothing to compare has no screen identities, so there is
 * no screen to choose and the link points at the whole catalogue.
 */
export function ViewerShareCatalogueScreen({
  viewport,
}: {
  viewport: Viewport;
}) {
  return (
    <SharePage
      viewport={viewport}
      state="default"
      screen="product/viewer/share/catalogue"
      screens={false}
    />
  );
}
