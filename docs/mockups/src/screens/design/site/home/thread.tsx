/**
 * The comment thread of the Review frame, pinned to the PriceCard of the
 * mobile pricing screen: Maya's note and Sam's answer, Reply, the pull
 * request it keeps in step with, and Approve. Maya's cursor rests under it.
 * A depiction, so its controls are text.
 */

import { SiteIcon } from "../parts/icons.js";
import { SiteAvatar, SiteCursor, type SitePerson } from "../parts/people.js";

const MESSAGES: ReadonlyArray<{
  age: string;
  name: string;
  person: SitePerson;
  role: string;
  text: string;
}> = [
  {
    age: "2m",
    name: "Maya",
    person: "maya",
    role: "Design",
    text: "Padding feels tight on mobile.",
  },
  {
    age: "1m",
    name: "Sam",
    person: "sam",
    role: "Engineering",
    text: "Agreed. Let’s ask Claude for 24.",
  },
];

/** The thread on the PriceCard. */
export function Thread() {
  return (
    <div aria-hidden="true" className="site-comment">
      <div className="site-comment-head">
        <span className="site-home-thread-on">
          <SiteIcon name="component" size={14} />
          PriceCard
        </span>
        <span className="site-home-thread-where">pricing · mobile</span>
      </div>
      <div className="site-home-thread-messages">
        {MESSAGES.map((message) => (
          <div className="site-home-message" key={message.name}>
            <SiteAvatar person={message.person} />
            <div>
              <p className="site-home-message-meta">
                <b>{message.name}</b>
                <span>{message.role}</span>
                <span className="site-home-message-age">{message.age}</span>
              </p>
              <p className="site-home-message-text">{message.text}</p>
            </div>
          </div>
        ))}
      </div>
      <span className="site-home-thread-reply">Reply</span>
      <div className="site-home-thread-foot">
        <span className="site-home-thread-sync">
          <SiteIcon name="pullRequest" size={14} />
          In step with #482
        </span>
        <span className="site-comment-approve">
          <SiteIcon name="check" size={15} />
          Approve
        </span>
      </div>
      <SiteCursor className="site-home-review-maya" person="maya" />
    </div>
  );
}
