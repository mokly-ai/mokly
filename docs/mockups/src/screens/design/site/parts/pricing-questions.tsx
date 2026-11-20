/**
 * The questions, drawn as resolved comment threads beside the section
 * heading: each thread names its topic and the frame it is pinned to, then
 * the question and Mokly's answer, joined by a reply line. The avatars and
 * the pins are depictions. The Plans and billing documentation page has no
 * mockup of its own, so its action draws without a link.
 */

import { SiteIcon } from "./icons.js";
import { SiteAvatar } from "./people.js";
import {
  PRICING_ASKERS,
  PRICING_QUESTIONS,
  type PricingQuestion,
} from "./pricing-questions-data.js";

/** One resolved thread: its head, the question and the answer. */
function Thread({ question }: { question: PricingQuestion }) {
  const asker = PRICING_ASKERS[question.asker];
  const heading = `pricing-question-${question.id}`;
  return (
    <article aria-labelledby={heading} className="site-pricing-thread">
      <p className="site-pricing-thread-head">
        <span className="site-pricing-thread-topic">
          <SiteIcon name={question.icon} size={14} />
          {question.topic}
        </span>{" "}
        <span aria-hidden="true" className="site-pricing-thread-pin">
          {question.pin}
        </span>
        <span className="site-pricing-thread-resolved">
          <SiteIcon name="checkCircle" size={14} />
          <span className="site-pricing-sr">Resolved</span>
        </span>
      </p>
      <div className="site-pricing-message">
        <SiteAvatar person={question.asker} />
        <div>
          <p className="site-pricing-message-meta">
            <b>{asker.name}</b> <span>{asker.team}</span>
          </p>
          <h3 className="site-pricing-question" id={heading}>
            {question.question}
          </h3>
        </div>
      </div>
      <div className="site-pricing-message site-pricing-message--answer">
        <SiteAvatar person="mokly" />
        <div>
          <p className="site-pricing-message-meta">
            <b>Mokly</b>
          </p>
          <p className="site-pricing-answer">{question.answer}</p>
        </div>
      </div>
    </article>
  );
}

/** The questions section: the heading, the documentation action and the threads. */
export function PricingQuestions() {
  return (
    <section
      aria-labelledby="pricing-questions-title"
      className="site-pricing-questions"
    >
      <div className="site-pricing-questions-intro">
        <h2 className="site-pricing-section-title" id="pricing-questions-title">
          Questions, <br />
          <span>resolved.</span>
        </h2>
        <p className="site-pricing-docs">
          <span className="site-button site-button--secondary">
            Read Plans and billing{" "}
            <span aria-hidden="true" className="site-button-arrow">
              &#8594;
            </span>
          </span>
        </p>
      </div>
      <div className="site-pricing-threads">
        {PRICING_QUESTIONS.map((question) => (
          <Thread key={question.id} question={question} />
        ))}
      </div>
    </section>
  );
}
