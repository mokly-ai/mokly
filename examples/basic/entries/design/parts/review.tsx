import { DESTINATIONS, type DesignDestination } from "./destinations.js";
import { MiniDetails, MiniWelcome } from "./mini_screens.js";
import { NavDrawer, NavTree, type ChangesStatus, type NavNode } from "./nav.js";
import { REMOVED_SCREEN_ROWS } from "./nav_data.js";
import { BrowserFrame, PhoneFrame } from "./stage.js";
import {
  ExcludedStylesheetList,
  PAGE_STYLE_COPY,
  SCREEN_STYLE_COPY,
  StylesheetEvidenceList,
} from "./stylesheet_evidence.js";

/** Comparison classification states depicted inside a loaded comparison. */
export type ReviewState = "added" | "changed" | "removed" | "styles-changed";

const CHANGED_NODES: readonly NavNode[] = [
  {
    key: "example",
    depth: 0,
    kind: "folder",
    label: "Example",
    open: true,
  },
  {
    key: "screens",
    depth: 1,
    kind: "folder",
    label: "Screens",
    open: true,
  },
  {
    key: "welcome",
    depth: 2,
    kind: "screen",
    label: "Welcome",
    to: DESTINATIONS.current,
  },
  {
    key: "details",
    depth: 2,
    kind: "screen",
    label: "Details",
    to: DESTINATIONS.added,
  },
  ...REMOVED_SCREEN_ROWS.map((entry) => ({
    key: entry.key,
    depth: 0,
    kind: "screen" as const,
    label: `${entry.title} · Removed`,
    to: entry.design,
  })),
];

/** Changes uses the same catalogue navigation and filter as All. */
export function ReviewNav({
  activeDestination,
  activeTitle,
}: {
  activeDestination?: DesignDestination | undefined;
  activeTitle?: string | undefined;
}) {
  return (
    <NavTree
      activeDestination={activeDestination}
      activeLabel={activeTitle}
      changedOnly
      nodes={CHANGED_NODES}
    />
  );
}

/** Empty Changes retains the catalogue filter. */
export function EmptyReviewNav() {
  return <NavTree changedOnly changedCount={0} nodes={[]} />;
}

/** Changes holding only the screen its stylesheet evidence keeps. */
export function StyleReviewNav({ welcome }: { welcome: DesignDestination }) {
  return (
    <NavTree
      activeLabel="Welcome"
      changedOnly
      changedCount={1}
      nodes={[
        {
          key: "example",
          depth: 0,
          kind: "folder",
          label: "Example",
          open: true,
        },
        {
          key: "screens",
          depth: 1,
          kind: "folder",
          label: "Screens",
          open: true,
        },
        {
          key: "welcome",
          depth: 2,
          kind: "screen",
          label: "Welcome",
          to: welcome,
        },
      ]}
    />
  );
}

/** The depicted Welcome preview each review artboard places on its stage. */
export function WelcomeShot({
  viewport,
  comparison = true,
}: {
  viewport: "desktop" | "mobile";
  comparison?: boolean;
}) {
  return viewport === "desktop" ? (
    <BrowserFrame address="example.test/welcome" expandable={!comparison}>
      <MiniWelcome />
    </BrowserFrame>
  ) : (
    <PhoneFrame small>
      <MiniWelcome compact />
    </PhoneFrame>
  );
}

/** The depicted Details preview, opened from All without a comparison. */
export function DetailsShot({ viewport }: { viewport: "desktop" | "mobile" }) {
  return viewport === "desktop" ? (
    <BrowserFrame address="example.test/details">
      <MiniDetails />
    </BrowserFrame>
  ) : (
    <PhoneFrame small>
      <MiniDetails compact />
    </PhoneFrame>
  );
}

/** Changes keeps its tabs and origin while a comparison is not yet usable. */
export function AvailabilityNav({
  drawer = false,
  status,
}: {
  drawer?: boolean;
  status: ChangesStatus;
}) {
  const props = { changedOnly: true, changesStatus: status, nodes: [] };
  return drawer ? <NavDrawer {...props} /> : <NavTree {...props} />;
}

/** Content exclusions belong in the secondary comparison details. */
export function IgnoredImpactCard() {
  return <p>Excluded content: example-nav.</p>;
}

/** The configured stylesheet that the screen cards name as changed. */
const STYLES = "generated/styles.css";

/** A changed stylesheet whose changed styles apply to neither Welcome nor Details. */
const EXCLUDED_STYLES = "generated/excluded.css";

/**
 * Welcome's Details in the Excluded (All) and Matched (Changes) designs. The
 * viewer shows the same Details in either filter: the retained file with the
 * changed styles that apply here, then the file it examined and excluded.
 */
export function MatchedAndExcludedStyleCard() {
  return (
    <>
      <StylesheetEvidenceList
        lead={SCREEN_STYLE_COPY.files}
        stylesheets={[
          {
            path: STYLES,
            outcomes: [
              {
                lead: SCREEN_STYLE_COPY.matched,
                selectors: [".example-head", "main a"],
              },
            ],
          },
        ]}
      />
      <ExcludedStylesheetList
        lead={SCREEN_STYLE_COPY.excluded}
        paths={[EXCLUDED_STYLES]}
      />
    </>
  );
}

/**
 * Details in the same branch links only the excluded file. Nothing keeps it in
 * Changes, so its Details end with the line for an unchanged screen.
 */
export function ExcludedOnlyStyleCard() {
  return (
    <>
      <ExcludedStylesheetList
        lead={SCREEN_STYLE_COPY.excluded}
        paths={[EXCLUDED_STYLES]}
      />
      <p>{SCREEN_STYLE_COPY.noChanges}</p>
    </>
  );
}

/** A changed stylesheet whose change can reach anything on the screen. */
export function UnresolvedStyleCard() {
  return (
    <StylesheetEvidenceList
      lead={SCREEN_STYLE_COPY.files}
      stylesheets={[
        {
          path: STYLES,
          outcomes: [
            { lead: SCREEN_STYLE_COPY.unresolved, selectors: [":root"] },
          ],
        },
      ]}
    />
  );
}

/** A changed stylesheet whose change has no style name to show. */
export function UnnamedStyleCard() {
  return (
    <StylesheetEvidenceList
      lead={SCREEN_STYLE_COPY.files}
      stylesheets={[
        {
          path: STYLES,
          outcomes: [{ lead: SCREEN_STYLE_COPY.unnamed, selectors: [] }],
        },
      ]}
    />
  );
}

/**
 * The changed handbook's stylesheets. The shared `.action` rule also changed
 * Action, so its handbook match reads as outside the changed components; the
 * handbook's own sheet changed no component and also has a change that can
 * apply anywhere on the page.
 */
export function PageStyleCard() {
  return (
    <StylesheetEvidenceList
      lead={PAGE_STYLE_COPY.files}
      stylesheets={[
        {
          path: "styles/actions.css",
          outcomes: [{ lead: PAGE_STYLE_COPY.outside, selectors: [".action"] }],
        },
        {
          path: "styles/handbook.css",
          outcomes: [
            { lead: PAGE_STYLE_COPY.matched, selectors: ["article h2"] },
            { lead: PAGE_STYLE_COPY.unresolved, selectors: [":root"] },
          ],
        },
      ]}
    />
  );
}
