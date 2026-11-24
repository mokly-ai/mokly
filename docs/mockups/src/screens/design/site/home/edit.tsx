/**
 * Frame 03 Edit: one tool window. Its title bar names the open screen and
 * the branch, with the agent tool active and the live session; its canvas
 * holds the section copy as a text layer beside the `pricing` artboard,
 * where Claude edits the selected PriceCard; the Claude chat is docked on
 * the right, and on a phone it follows the artboard. The copy is the page's
 * own text; the rest of the window is a depiction.
 */
// status: "ahead" (agent sessions, Claude)

import { MoklyMark } from "../parts/brand.js";
import { SiteIcon } from "../parts/icons.js";
import { SiteCursor, SitePresence } from "../parts/people.js";

import { AcmePricingPhone } from "./acme/acme-pricing.js";
import { AgentChat } from "./agent.js";
import { Artboard } from "./artboard.js";
import { CardSelection } from "./card-selection.js";
import { ModuleFrame, ModuleText } from "./module.js";

/** The window's title bar. */
function EditBar({ viewport }: { viewport: "mobile" | "desktop" }) {
  const wide = viewport === "desktop";
  return (
    <div aria-hidden="true" className="site-home-edit-bar">
      <span className="site-topbar-mark">
        <MoklyMark size={24} />
      </span>
      {wide ? (
        <span className="site-crumbs site-home-edit-crumbs">
          <span className="site-crumb">acme</span>
          <span className="site-crumb">
            <span className="site-crumb-sep">/</span>
            storefront
          </span>
          <span className="site-crumb">
            <span className="site-crumb-sep">/</span>
            pricing
          </span>
        </span>
      ) : null}
      <span className="site-home-viewer-branch">
        <SiteIcon name="branch" size={14} />
        feat/checkout-v2
      </span>
      <span className="site-home-edit-tools">
        <span className="site-home-edit-tool">
          <SiteIcon name="move" />
        </span>
        {/* status: "ahead" (comments) */}
        <span className="site-home-edit-tool">
          <SiteIcon name="comment" />
        </span>
        <span className="site-home-edit-tool site-home-edit-tool--active">
          <SiteIcon name="agent" />
        </span>
      </span>
      {wide ? (
        <>
          {/* status: "ahead" (presence, Claude) */}
          <SitePresence
            className="site-home-viewer-people"
            people={["sam", "claude"]}
          />
          <span className="site-home-edit-live">
            <span className="site-home-live-dot" />
            Live session
          </span>
        </>
      ) : null}
    </div>
  );
}

/** The Edit module. */
export function EditModule({ viewport }: { viewport: "mobile" | "desktop" }) {
  return (
    <article
      aria-labelledby="edit-title"
      className="site-module site-module--edit"
      id="edit"
    >
      <ModuleFrame name="03 Edit">
        <div className="site-detail site-detail--split">
          <EditBar viewport={viewport} />
          <div className="site-home-edit-body">
            <div className="site-home-edit-canvas">
              <ModuleText
                headingId="edit-title"
                index="03"
                kicker="Edit"
                title="Ask for the change beside the screen."
              >
                An agent edits the mockup source in a live branch session. Click
                an element to bring it into the conversation, then publish back
                to the branch.
              </ModuleText>
              <div aria-hidden="true" className="site-home-edit-board">
                <Artboard
                  device="phone"
                  live
                  name="pricing"
                  overlay={<CardSelection claude padding="24" tall />}
                >
                  <AcmePricingPhone />
                </Artboard>
                {/* status: "ahead" (presence, Claude) */}
                <SiteCursor className="site-home-edit-claude" person="claude" />
              </div>
            </div>
            <AgentChat />
          </div>
        </div>
      </ModuleFrame>
    </article>
  );
}
