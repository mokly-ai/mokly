const SURVEY_SECTIONS = [
  ["How often did you open the catalogue?", "Daily, weekly, or now and then."],
  ["Which screens did you share?", "Welcome, Details, and the example tour."],
  ["What was missing?", "A place to keep the notes beside each screen."],
  ["How did the tour read?", "Short enough to finish in one sitting."],
  ["Would you recommend it?", "Almost everyone said yes."],
  ["Anything else?", "Leave a note before the survey closes."],
] as const;

/**
 * The Farewell fragment as it stood before the screen was removed. Links in a
 * previous version do nothing, so the historical content carries none.
 */
export function MiniFarewell({ compact }: { compact?: boolean }) {
  return (
    <div className="mbk-shot">
      <div className="mbk-shot-pad">
        <div className="mbk-shot-nav">
          {compact ? "Menu" : "Example navigation"}
        </div>
        <h2>Thanks for looking around</h2>
        <p>
          The example catalogue ends here. Everything you opened stays available
          from the navigation.
        </p>
        <p>See you next time.</p>
      </div>
    </div>
  );
}

const TIMELINE_ENTRIES = [
  ["Spring", "The first screens were written and the tour was drafted."],
  ["Summer", "Notes moved next to the screens they describe."],
  ["Autumn", "The handbook grew a field guide and printing notes."],
  ["Winter", "The survey closed and the catalogue settled."],
] as const;

/**
 * The Timeline fragment as it stood before the screen was removed. It was only
 * ever drawn at desktop width, so it is the screen's one previous view.
 */
export function MiniTimeline() {
  return (
    <div className="mbk-shot">
      <div className="mbk-shot-pad">
        <div className="mbk-shot-nav">Example navigation</div>
        <h2>A year of the example catalogue</h2>
        <div className="mbk-shot-timeline">
          {TIMELINE_ENTRIES.map(([season, summary]) => (
            <section key={season}>
              <h3>{season}</h3>
              <p>{summary}</p>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * A tall historical fragment. The preview keeps its own scrolling, so the
 * frame shows the top of the screen with the rest below it.
 */
export function MiniSurvey({ compact }: { compact?: boolean }) {
  return (
    <div className="mbk-shot">
      <div className="mbk-shot-pad">
        <div className="mbk-shot-nav">
          {compact ? "Menu" : "Example navigation"}
        </div>
        <h2>Reader survey</h2>
        <p>Six short questions about the example catalogue.</p>
        <div className="mbk-shot-sections">
          {SURVEY_SECTIONS.map(([question, answer], index) => (
            <section key={question}>
              <h3>
                {index + 1}. {question}
              </h3>
              <p>{answer}</p>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
