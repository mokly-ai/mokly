import { DesignLink } from "./design_navigation.js";
import { DESTINATIONS } from "./destinations.js";

interface MiniScreenProps {
  compact?: boolean;
  /** Nothing entered yet, so the primary action is not available. */
  empty?: boolean;
  /** The last save did not complete. */
  error?: boolean;
  /** Shown inside a comparison, where links do nothing, so it carries none. */
  inert?: boolean;
  /** Continues well below the first screenful, as a long screen does. */
  long?: boolean;
  restyled?: boolean;
  revised?: boolean;
}

/**
 * Welcome's content below its introduction. The revision rewords one section
 * in place, so every other section keeps its position in both versions.
 */
const WELCOME_SECTIONS = [
  [
    "Browse the screens",
    "Every screen opens in its own frame, beside its notes.",
  ],
  ["Read the handbook", "Whole documents keep their own layout and headings."],
  ["Try the components", "Each component keeps its saved variants together."],
  [
    "Follow the tour",
    "The tour opens the screens in the order readers meet them.",
  ],
  ["Search the catalogue", "Type a word or a tag to narrow the navigation."],
  ["Share a screen", "Copy a frame's address to send the same screen on."],
  ["Keep notes nearby", "Notes stay beside the screen they describe."],
  ["Switch the appearance", "Light and dark screens follow one setting."],
  ["Review a change", "Changed screens gather in one list until they merge."],
  ["Come back later", "Everything you opened stays in the navigation."],
] as const;

/** The one section the revision rewords, named by its previous heading. */
const REVISED_SECTION = {
  previous: "Follow the tour",
  heading: "Take the example tour",
  summary: "The tour now starts here and ends on the details screen.",
} as const;

function WelcomeSections({ revised }: { revised?: boolean | undefined }) {
  return (
    <div className="mbk-shot-sections">
      {WELCOME_SECTIONS.map(([title, body]) => {
        const [heading, summary] =
          revised && title === REVISED_SECTION.previous
            ? [REVISED_SECTION.heading, REVISED_SECTION.summary]
            : [title, body];
        return (
          <section key={title}>
            <h3>{heading}</h3>
            <p>{summary}</p>
          </section>
        );
      })}
    </div>
  );
}

/** Welcome's heading, the revision's new introduction, and its one link. */
function WelcomeIntroduction({
  empty,
  inert,
  revised,
}: {
  empty?: boolean | undefined;
  inert?: boolean | undefined;
  revised?: boolean | undefined;
}) {
  return (
    <>
      <h2>{revised ? "Welcome to the Mokly example" : "Welcome to Mokly"}</h2>
      {revised ? <p>A short introduction now welcomes new readers.</p> : null}
      {empty ? (
        <>
          <div className="mbk-shot-field">Workspace name</div>
          <span className="mbk-shot-action">Create workspace</span>
        </>
      ) : null}
      <DesignLink to={inert ? undefined : DESTINATIONS.details}>
        <span className="mbk-shot-link">Open the details screen</span>
      </DesignLink>
    </>
  );
}

/** Miniature depiction of the example Welcome fragment. */
export function MiniWelcome({
  compact,
  empty,
  error,
  inert,
  long,
  restyled,
  revised,
}: MiniScreenProps) {
  const introduction = (
    <WelcomeIntroduction empty={empty} inert={inert} revised={revised} />
  );
  return (
    <div className={restyled ? "mbk-shot mbk-shot--restyled" : "mbk-shot"}>
      <div className="mbk-shot-pad">
        <div className="mbk-shot-nav">
          {compact ? "Menu" : "Example navigation"}
        </div>
        {error ? (
          <p className="mbk-shot-error">
            Couldn’t save this workspace. Try again.
          </p>
        ) : null}
        {long ? (
          <>
            <div className="mbk-shot-hero">{introduction}</div>
            <WelcomeSections revised={revised} />
          </>
        ) : (
          introduction
        )}
      </div>
    </div>
  );
}

/**
 * Welcome's long content for a drawn scroll position, always inside a
 * comparison and so without a working link. The introduction and every
 * section keep one fixed height and clip what does not fit, so an offset drawn
 * in CSS lands on the same rows whatever the text wrapping, and the reworded
 * section moves nothing else.
 */
export function WelcomeRows({ revised }: { revised?: boolean | undefined }) {
  return (
    <div className="mbk-shot-rows">
      <div className="mbk-shot-hero">
        <WelcomeIntroduction inert revised={revised} />
      </div>
      <WelcomeSections revised={revised} />
    </div>
  );
}

/** Welcome as one long page of fixed-height rows below its navigation bar. */
export function MiniWelcomePage({
  compact,
  revised,
}: {
  compact?: boolean | undefined;
  revised?: boolean | undefined;
}) {
  return (
    <div className="mbk-shot mbk-shot--page">
      <div className="mbk-shot-nav">
        {compact ? "Menu" : "Example navigation"}
      </div>
      <WelcomeRows revised={revised} />
    </div>
  );
}

/** Miniature depiction of the example Details fragment. */
export function MiniDetails({ compact }: MiniScreenProps) {
  return (
    <div className="mbk-shot">
      <div className="mbk-shot-pad">
        <h2>{compact ? "Details" : "Example catalogue details"}</h2>
        <p>This screen is synthetic and belongs only to the package example.</p>
        <DesignLink to={DESTINATIONS.welcome}>
          <span className="mbk-shot-link">Return to welcome</span>
        </DesignLink>
      </div>
    </div>
  );
}
