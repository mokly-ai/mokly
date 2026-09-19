import { DesignLink } from "./design_navigation.js";
import { DESTINATIONS } from "./destinations.js";

interface MiniScreenProps {
  compact?: boolean;
  restyled?: boolean;
  revised?: boolean;
}

/** Miniature depiction of the example Welcome fragment. */
export function MiniWelcome({ compact, restyled, revised }: MiniScreenProps) {
  return (
    <div className={restyled ? "mbk-shot mbk-shot--restyled" : "mbk-shot"}>
      <div className="mbk-shot-pad">
        <div className="mbk-shot-nav">
          {compact ? "Menu" : "Example navigation"}
        </div>
        <h2>{revised ? "Welcome to the Mokly example" : "Welcome to Mokly"}</h2>
        {revised ? <p>A short introduction now welcomes new readers.</p> : null}
        <DesignLink to={DESTINATIONS.details}>
          <span className="mbk-shot-link">Open the details screen</span>
        </DesignLink>
      </div>
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
