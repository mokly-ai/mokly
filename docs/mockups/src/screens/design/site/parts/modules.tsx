/**
 * The three feature modules on the home. Each pairs the approved feature
 * copy with a small framed detail of the catalogue shell — the Changes
 * filter, a comment pinned to a screen, and the agent rail beside a screen —
 * drawn as token-styled shapes carrying only real product labels.
 */

import type { ReactNode } from "react";

import { SiteActions } from "./actions.js";
import { SendGlyph } from "./glyphs.js";

function BrowseDetail() {
  return (
    <div className="site-detail">
      <div className="site-filter site-filter--detail">
        <span className="site-filter-option site-filter-option--current">
          All
        </span>
        <span className="site-filter-option">
          Changes<span className="site-filter-count">3</span>
        </span>
      </div>
      <div className="site-detail-rows">
        {["Welcome", "Details", "Action"].map((label) => (
          <span className="site-detail-row" key={label}>
            <span aria-hidden="true" className="site-detail-dot" />
            {label}
            <span className="site-detail-chip">Changed</span>
          </span>
        ))}
      </div>
    </div>
  );
}

function ReviewDetail() {
  return (
    <div className="site-detail site-detail--split">
      <div className="site-detail-screen">
        <span
          aria-hidden="true"
          className="site-detail-bar site-detail-bar--wide"
        />
        <span aria-hidden="true" className="site-detail-block" />
        <span aria-hidden="true" className="site-detail-bar" />
        <span className="site-pin">1</span>
      </div>
      <div className="site-comment">
        <p className="site-comment-head">
          <span className="site-pin site-pin--inline">1</span>Comment
        </p>
        <span
          aria-hidden="true"
          className="site-detail-bar site-detail-bar--wide"
        />
        <span aria-hidden="true" className="site-detail-bar" />
        <span className="site-comment-approve">Approve</span>
      </div>
    </div>
  );
}

function EditDetail() {
  return (
    <div className="site-detail site-detail--split">
      <div className="site-detail-screen">
        <span
          aria-hidden="true"
          className="site-detail-bar site-detail-bar--wide"
        />
        <span aria-hidden="true" className="site-detail-block" />
        <span aria-hidden="true" className="site-detail-bar" />
      </div>
      <div className="site-agent">
        <p className="site-comment-head">Agent session</p>
        <span aria-hidden="true" className="site-agent-turn" />
        <span
          aria-hidden="true"
          className="site-agent-turn site-agent-turn--reply"
        />
        <span className="site-agent-input">
          Describe the change
          <span aria-hidden="true" className="site-agent-send">
            <SendGlyph />
          </span>
        </span>
      </div>
    </div>
  );
}

interface SiteModule {
  body: string;
  detail: ReactNode;
  id: string;
  label: string;
  number: string;
  title: string;
}

const MODULES: readonly SiteModule[] = [
  {
    body: "Each branch and pull request publishes a catalogue built from your real components. Changes shows what moved, and the check on the pull request counts it.",
    detail: <BrowseDetail />,
    id: "browse",
    label: "BROWSE",
    number: "01",
    title: "See every branch as screens.",
  },
  {
    body: "Pin a comment to the component it is about and approve when it is right. The conversation stays in step with the pull request review.",
    detail: <ReviewDetail />,
    id: "review",
    label: "REVIEW",
    number: "02",
    title: "Comment on the screen itself.",
  },
  {
    body: "An agent edits the mockup source in a live branch session. Click an element to bring it into the conversation, then publish back to the branch.",
    detail: <EditDetail />,
    id: "edit",
    label: "EDIT",
    number: "03",
    title: "Ask for the change beside the screen.",
  },
];

/** Browse, review and edit, each with its framed detail of the shell. */
export function SiteModules() {
  return (
    <section className="site-modules">
      <div className="site-section-head">
        <h2>
          Browse, review, edit.
          <br />
          <span className="site-accent">One place for all of it.</span>
        </h2>
        <p>Every branch becomes a catalogue your whole team can open.</p>
      </div>
      <div className="site-module-grid">
        {MODULES.map((feature) => (
          <article className="site-module" id={feature.id} key={feature.id}>
            <div className="site-module-detail">{feature.detail}</div>
            <p className="site-module-eyebrow">
              <span className="site-module-number">{feature.number}</span>
              <span className="site-feature-label">{feature.label}</span>
            </p>
            <h3>{feature.title}</h3>
            <p className="site-module-body">{feature.body}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

const STEPS = [
  {
    body: "Author with React and your shared components.",
    title: "Shape the next screen.",
  },
  {
    body: "Open the pull request check to review the screens that changed.",
    title: "Publish the branch.",
  },
  {
    body: "Keep comments and approvals with the pull request.",
    title: "Build from a shared decision.",
  },
] as const;

/** The open-foundation closing with the repeated actions and three steps. */
export function SiteClosing() {
  return (
    <section className="site-closing" id="foundation">
      <div className="site-closing-panel">
        <div className="site-closing-copy">
          <p className="site-eyebrow">An open foundation</p>
          <h2>
            Your screens.
            <br />
            <span className="site-accent">Your building blocks.</span>
          </h2>
          <p>
            Author locally with the open-source Mokly CLI. Keep your screens in
            Git and host the catalogue anywhere. The cloud adds hosting, review
            and the agent; it never owns the source.
          </p>
          <SiteActions />
        </div>
        <ol className="site-steps">
          {STEPS.map((step, index) => (
            <li className="site-step" key={step.title}>
              <span className="site-step-number">0{index + 1}</span>
              <h3>{step.title}</h3>
              <p>{step.body}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
