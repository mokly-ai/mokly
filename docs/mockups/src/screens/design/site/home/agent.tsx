/**
 * The Claude chat docked in the Edit window, in its finished state: the
 * session's earlier turn, the prompt with the PriceCard chip, Claude's edit
 * of `pricing.mockup.tsx` with its diff hunk and its answer, the composer,
 * and Publish with Replay. A depiction, so its controls are text.
 */
// status: "ahead" (agent sessions, Claude)

import type { ReactNode } from "react";

import { SiteIcon } from "../parts/icons.js";
import { SiteAvatar } from "../parts/people.js";

/** The chip of a picked element inside a message. */
function PickedChip() {
  return (
    <span className="site-home-chip">
      <SiteIcon name="component" size={11} />
      PriceCard
    </span>
  );
}

/** A message that the person in the session sent. */
function Prompt({ children }: { children: ReactNode }) {
  return (
    <span className="site-agent-turn">
      <PickedChip />
      {children}
    </span>
  );
}

/** One of Claude's answers. */
function Reply({ children }: { children: ReactNode }) {
  return (
    <span className="site-agent-turn site-agent-turn--reply">
      <SiteAvatar person="claude" small />
      <span className="site-home-reply-body">{children}</span>
    </span>
  );
}

/** The lines of the diff hunk: their kind and their text. */
const DIFF: ReadonlyArray<readonly ["add" | "del" | "same", string]> = [
  ["same", '    plan="regular"'],
  ["del", "-   padding={16}"],
  ["add", "+   padding={24}"],
  ["same", "    featured"],
  ["same", "  >"],
  ["del", '-   <Button tone="secondary" … />'],
  ["add", '+   <Button tone="primary" … />'],
];

/** Claude's edit of the mockup source. */
function Diff() {
  return (
    <span className="site-home-diff">
      <span className="site-home-diff-head">
        pricing.mockup.tsx
        <span>
          <span className="site-home-diff-add">+2</span>
          <span className="site-home-diff-del">−2</span>
        </span>
      </span>
      {DIFF.map(([kind, text], index) => (
        <span
          className={`site-home-diff-line site-home-diff-line--${kind}`}
          key={index}
        >
          {text}
        </span>
      ))}
    </span>
  );
}

/** The docked chat. */
export function AgentChat() {
  return (
    <div aria-hidden="true" className="site-agent">
      <div className="site-home-agent-head">
        <SiteAvatar person="claude" small />
        <b>Claude</b>
        <span className="site-home-agent-badge">Agent</span>
      </div>
      <div className="site-home-agent-log">
        <span className="site-home-agent-note">
          src/mockups/pricing.mockup.tsx
        </span>
        <Prompt>Make Regular the featured plan</Prompt>
        <Reply>
          Done. Regular now passes <code>featured</code>, so it shows the Most
          popular badge.
        </Reply>
        <span className="site-home-agent-note">
          Published to feat/checkout-v2
        </span>
        <Prompt>
          Make the PriceCard padding 24 and use the Primary button
        </Prompt>
        <Reply>
          Editing <code>pricing.mockup.tsx</code>
          <Diff />
        </Reply>
        <Reply>
          Done. The PriceCard now has padding 24 and the Primary button.
        </Reply>
      </div>
      <span className="site-agent-input">
        <span className="site-home-agent-placeholder">
          Click an element on the screen, then ask
        </span>
        <span className="site-agent-send">
          <SiteIcon name="send" size={17} />
        </span>
      </span>
      <span className="site-home-agent-foot">
        <span className="site-home-publish">
          <SiteIcon name="branch" size={15} />
          Publish to feat/checkout-v2
        </span>
        <span className="site-home-replay">
          <SiteIcon name="replay" size={17} />
        </span>
      </span>
    </div>
  );
}
