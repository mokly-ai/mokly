import type { ReactNode } from "react";

import { defineScreen } from "@mokly/mokly";

import { PreviewWorkspace } from "../../components/parts/workspace.js";
import { designMetadata } from "../../metadata.js";
import { PROFILE_CHANGES_ROWS } from "../../parts/account_nav_data.js";
import { artboards } from "../../parts/artboards.js";
import { DESTINATIONS } from "../../parts/destinations.js";
import { DetailsPanel } from "../../parts/details.js";
import { ENTRY_PATHS } from "../../parts/entry_paths.js";
import { MiniProfile, MiniSecurity } from "../../parts/mini_account.js";
import { NavTree } from "../../parts/nav.js";
import { NAV_TREE_PROFILE_OPEN } from "../../parts/nav_data.js";
import { ReasonSentences } from "../../parts/reason_sentences.js";
import {
  ScreenHead,
  Shell,
  ViewSwitch,
  type ArtboardViewport,
  type ChangedView,
} from "../../parts/shell.js";
import { BrowserFrame, PhoneFrame } from "../../parts/stage.js";

/** Only Security changed on the branch these four states depict. */
const CHANGED_COUNT = 1;

/**
 * Security changed in its Light views on both viewports, so its first changed
 * view, mobile before desktop and light before dark, is Mobile · Light.
 */
const SECURITY_VIEWS: readonly ChangedView[] = [
  { viewport: "mobile", scheme: "light" },
  { viewport: "desktop", scheme: "light" },
];

type ProfileSubject = "profile" | "profileSecurity";

/**
 * The selected Profile or Security screen in both previews, Details closed. A
 * changed screen's Details add its comparison details.
 */
function ProfileWorkspace({
  comparisonEvidence,
  subject,
  viewport,
}: {
  comparisonEvidence?: ReactNode;
  subject: ProfileSubject;
  viewport: ArtboardViewport;
}) {
  return (
    <PreviewWorkspace
      viewport={viewport}
      inspector={
        <DetailsPanel
          comparisonEvidence={comparisonEvidence}
          subject={subject}
        />
      }
      render={(previewViewport) => {
        const compact = previewViewport === "mobile";
        const content =
          subject === "profile" ? (
            <MiniProfile compact={compact} />
          ) : (
            <MiniSecurity compact={compact} />
          );
        return previewViewport === "mobile" ? (
          <PhoneFrame label="Mobile" small={viewport === "mobile"}>
            {content}
          </PhoneFrame>
        ) : (
          <BrowserFrame
            address={
              subject === "profile"
                ? "example.test/account/profile"
                : "example.test/account/profile/security"
            }
            label="Desktop"
          >
            {content}
          </BrowserFrame>
        );
      }}
    />
  );
}

/**
 * Profile and Security render no registered component, so the shell disables
 * Highlight components with its empty reason.
 */
function viewSwitch(viewport: ArtboardViewport) {
  return (
    <ViewSwitch
      active={viewport === "mobile" ? "mobile" : "both"}
      highlight="empty"
    />
  );
}

/**
 * The Profile screen is its folder's own page, so its row is the folder's row:
 * a link beside a disclosure that lists its variant, then the folder's
 * Notifications and Security screens. Its only crumb is the Account folder.
 */
function FolderScreen({ viewport }: { viewport: ArtboardViewport }) {
  return (
    <Shell
      design={DESTINATIONS.indexEntry}
      viewport={viewport}
      nav={
        viewport === "desktop" ? (
          <NavTree
            activeDestination={DESTINATIONS.indexEntry}
            changedCount={CHANGED_COUNT}
            nodes={NAV_TREE_PROFILE_OPEN}
          />
        ) : null
      }
    >
      <ScreenHead
        action={viewSwitch(viewport)}
        crumbs={["Account"]}
        path={ENTRY_PATHS.profile}
        title="Profile"
      />
      <ProfileWorkspace subject="profile" viewport={viewport} />
    </Shell>
  );
}

/** A member of the Profile folder, whose last crumb opens the folder's screen. */
function FolderMember({ viewport }: { viewport: ArtboardViewport }) {
  return (
    <Shell
      design={DESTINATIONS.indexMember}
      viewport={viewport}
      nav={
        viewport === "desktop" ? (
          <NavTree
            activeDestination={DESTINATIONS.indexMember}
            changedCount={CHANGED_COUNT}
            nodes={NAV_TREE_PROFILE_OPEN}
          />
        ) : null
      }
    >
      <ScreenHead
        action={viewSwitch(viewport)}
        crumbs={["Account", { label: "Profile", to: DESTINATIONS.indexEntry }]}
        path={ENTRY_PATHS.profileSecurity}
        title="Security"
      />
      <ProfileWorkspace subject="profileSecurity" viewport={viewport} />
    </Shell>
  );
}

/**
 * Changes keeps the unmodified Profile row as an undotted container for its
 * changed member. Profile stays selected after the filter switch, so its own
 * preview remains on the stage.
 */
function FolderScreenChanges({ viewport }: { viewport: ArtboardViewport }) {
  return (
    <Shell
      design={DESTINATIONS.indexEntryChanges}
      viewport={viewport}
      nav={
        viewport === "desktop" ? (
          <NavTree
            activeKey="profile"
            changedCount={CHANGED_COUNT}
            changedOnly
            nodes={PROFILE_CHANGES_ROWS}
          />
        ) : null
      }
    >
      <ScreenHead
        action={viewSwitch(viewport)}
        crumbs={["Account"]}
        path={ENTRY_PATHS.profile}
        status="unmodified"
        title="Profile"
      />
      <ProfileWorkspace subject="profile" viewport={viewport} />
    </Shell>
  );
}

/**
 * The first changed member, which activating the Profile row in Changes opens.
 * Profile was not a changed entry, so Security opens on its first changed view
 * instead of the sticky selection: Mobile on both artboards, with the viewport
 * control marking the desktop view that also changed.
 */
function MemberChanges({ viewport }: { viewport: ArtboardViewport }) {
  return (
    <Shell
      design={DESTINATIONS.indexMemberChanges}
      changedViews={SECURITY_VIEWS}
      viewport={viewport}
      nav={
        viewport === "desktop" ? (
          <NavTree
            activeKey="profile-security"
            changedCount={CHANGED_COUNT}
            changedOnly
            nodes={PROFILE_CHANGES_ROWS}
          />
        ) : null
      }
    >
      <ScreenHead
        comparisons
        action={
          <ViewSwitch
            active="mobile"
            changedViews={SECURITY_VIEWS}
            highlight="empty"
          />
        }
        comparisonMode="current"
        crumbs={["Account", "Profile"]}
        path={ENTRY_PATHS.profileSecurity}
        status="changed"
        title="Security"
      />
      <ProfileWorkspace
        comparisonEvidence={<ReasonSentences reasons={["material"]} />}
        subject="profileSecurity"
        viewport={viewport}
      />
    </Shell>
  );
}

/** Browse and Changes states for a screen that is its folder's own page. */
export const indexScreen = defineScreen({
  ...designMetadata,
  colorSchemes: ["light"],
  description:
    "A screen that is its folder's own page, selected, with its variant and the folder's other members listed under its row.",
  ...artboards({
    desktop: <FolderScreen viewport="desktop" />,
    mobile: <FolderScreen viewport="mobile" />,
  }),
  slug: "screen",
  rationale:
    "A screen named index takes its folder's path, so the folder has no row of its own: the screen's row stands in its place. The row keeps its link beside a separate disclosure, and the disclosure is named for the contents, because its list holds the screen's variants and then the folder's other members in folder order.",
  title: "Folder screen",
});
export const memberScreen = defineScreen({
  ...designMetadata,
  colorSchemes: ["light"],
  description:
    "A member of a screen's folder, selected, with breadcrumbs that end in the screen the folder belongs to.",
  ...artboards({
    desktop: <FolderMember viewport="desktop" />,
    mobile: <FolderMember viewport="mobile" />,
  }),
  slug: "member",
  rationale:
    "The folder's own screen supplies the folder's title, so a member's last crumb reads Profile and opens that screen, the same page its row opens.",
  title: "Folder member",
});
export const screenChangesScreen = defineScreen({
  ...designMetadata,
  colorSchemes: ["light"],
  description:
    "Changes holding a changed member under its folder's own screen, whose own render is unmodified.",
  ...artboards({
    desktop: <FolderScreenChanges viewport="desktop" />,
    mobile: <FolderScreenChanges viewport="mobile" />,
  }),
  slug: "screen-changes",
  rationale:
    "A changed member is not a variant, so it does not mark the screen above it, just as it would not mark a folder row. The unmodified screen stays visible as an undotted container for its changed member, adds no Changes row or count, and keeps its own preview while it stays selected.",
  title: "Folder screen in Changes",
});
export const memberChangesScreen = defineScreen({
  ...designMetadata,
  colorSchemes: ["light"],
  description:
    "The first changed member, opened on its first changed view by activating its folder screen's row in Changes.",
  ...artboards({
    desktop: <MemberChanges viewport="desktop" />,
    mobile: <MemberChanges viewport="mobile" />,
  }),
  slug: "member-changes",
  rationale:
    "Activating an unmodified container row in Changes opens the first changed row it holds, as an unmodified variant parent opens its first changed variant, so a reviewer always lands on something that changed. The selection was not a changed entry, so the member opens on its first changed view, Mobile · Light, rather than the sticky Both, and the viewport control marks the desktop view that also changed. The comparison band opens in Current; the other modes are depictions until a matching comparison state is authored.",
  title: "First changed member",
});
