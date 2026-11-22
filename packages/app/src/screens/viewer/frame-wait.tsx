import { DropdownMenu } from "@firna/ui/dropdown";
import { useRef } from "react";

import { Pending } from "../../components/page-parts";
import { StatePlaceholder } from "../../components/placeholders";
import { useDocumentTitle } from "../../layout/document-title";
import { AccountTrigger } from "../../viewer/account-trigger";
import { SlotBar } from "../../viewer/bar";
import { CompactBarProvider, useViewerBarWidth } from "../../viewer/bar-width";
import { BarAction } from "../../viewer/chrome";
import {
  AccountTriggerWait,
  ProjectTriggerWait,
  PublicationSlotWait,
} from "../../viewer/chrome-wait";
import type { ViewerSlots } from "../../viewer/host";
import { ViewerStage } from "../../viewer/placeholder";
import { StageCard } from "../../viewer/stage-card";
import type { WaitingIdentity } from "../account/account-shell";

import { ViewerMain } from "./body";
import { moreMenu } from "./more-menu";
import { accountLabel } from "./slots";

/**
 * More while the route reads the project: the same menu, closed and with
 * nothing to list, so its trigger keeps the place the menu gives it, and waits
 * there, disabled.
 */
function MoreWait() {
  return (
    <DropdownMenu {...moreMenu} entries={[]} open={false}>
      {() => (
        <BarAction label="More" popup="menu" chevron slot="more" waiting />
      )}
    </DropdownMenu>
  );
}

/**
 * The six cloud controls while the route reads the project, each in its
 * waiting form: the triggers the project names wait as placeholders in their
 * own frames, History, Share, Settings and More keep their labels and draw
 * themselves disabled, and the account names the reader once the session
 * read has said who that is. `compact` is the bar's composition, which shortens
 * the account's label as the loaded bar does.
 */
function waitingSlots(
  identity: WaitingIdentity,
  compact: boolean,
): ViewerSlots {
  return {
    project: <ProjectTriggerWait />,
    publication: <PublicationSlotWait />,
    history: (
      <BarAction label="History" icon="history" slot="history" waiting />
    ),
    share: <BarAction label="Share" tone="secondary" slot="share" waiting />,
    settings: (
      <BarAction label="Settings" icon="settings" slot="settings" waiting />
    ),
    account:
      identity.kind === "signed-in" ? (
        <AccountTrigger {...accountLabel(identity.user, compact)} waiting />
      ) : (
        <AccountTriggerWait />
      ),
    more: <MoreWait />,
  };
}

/**
 * The viewer route while it reads the project: the cloud frame, because the
 * package viewer appears only once a publication is ready, as the catalogue's
 * project read draws it. The whole frame is one waiting region. The heading's
 * own text, the project and its publication, is the read's to give, so the
 * heading holds `wait`, the read's one name, for screen readers, and the
 * stage's waiting card, whose title would repeat it, draws a bar. `identity`
 * is who the session read has found, once it has answered. The frame measures
 * its own width, as the viewer does, so the bar waits in the composition that
 * the loaded bar draws at that width.
 */
export function ViewerFrameWait({
  wait,
  identity,
}: {
  wait: string;
  identity: WaitingIdentity;
}) {
  const root = useRef<HTMLDivElement>(null);
  const bar = useViewerBarWidth(root);
  useDocumentTitle(wait);
  return (
    <div
      ref={root}
      className="folio-root fo-viewer-screen"
      data-mkc-screen="viewer"
    >
      {bar.probe}
      <CompactBarProvider compact={bar.compact} labels={bar.labels}>
        <ViewerMain beneath={false}>
          <Pending label={wait} labelMode="screen-reader-only">
            {(name) => (
              <>
                <h1 className="fo-sr-only">{name}</h1>
                <ViewerStage
                  bar={<SlotBar slots={waitingSlots(identity, bar.compact)} />}
                >
                  <StageCard>
                    <StatePlaceholder size="md" />
                  </StageCard>
                </ViewerStage>
              </>
            )}
          </Pending>
        </ViewerMain>
      </CompactBarProvider>
    </div>
  );
}
