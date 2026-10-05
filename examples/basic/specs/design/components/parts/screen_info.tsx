import { ComparisonDetails } from "./comparison_details.js";
import { screenComparison } from "./comparison_fixtures.js";
import { SCREENS, screenIdentity } from "./metadata.js";
import type { ScreenPageState } from "./screen_preview.js";

/** A consuming screen's Details panel: what it is, its source and comparison facts. */
export function ScreenInfo({ state }: { state: ScreenPageState }) {
  const screen = SCREENS[screenIdentity(state)];
  return (
    <>
      <section>
        <h3>About {screen.title}</h3>
        <p>{screen.description}</p>
        <p className="ce-muted">
          Source <code>{screen.source}</code>
        </p>
      </section>
      <ComparisonDetails comparison={screenComparison(state)} />
    </>
  );
}
