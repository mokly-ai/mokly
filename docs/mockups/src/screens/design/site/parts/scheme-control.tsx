/**
 * The light and dark control that the footer of every page carries: a group
 * of two native radios named Color scheme, Light with a sun and Dark with a
 * moon, each drawn as one segment of a track. The radio of the rendered
 * document's scheme is checked. Native radios give the group its keyboard
 * behaviour, and the site's small script island applies the choice.
 */

import { useMockupRenderContext } from "../../../../render-context";

import { SiteIcon, type SiteIconName } from "./icons.js";

/** The two options, in reading order. */
const SCHEMES: ReadonlyArray<
  readonly ["light" | "dark", string, SiteIconName]
> = [
  ["light", "Light", "sun"],
  ["dark", "Dark", "moon"],
];

/** The scheme control, with the rendered document's scheme checked. */
export function SiteSchemeControl() {
  const { colorScheme } = useMockupRenderContext();
  return (
    <fieldset aria-label="Color scheme" className="site-scheme">
      {SCHEMES.map(([scheme, label, icon]) => (
        <label className="site-scheme-option" key={scheme}>
          <input
            className="site-scheme-input"
            defaultChecked={scheme === colorScheme}
            name="site-scheme"
            type="radio"
            value={scheme}
          />
          <SiteIcon name={icon} size={15} />
          {label}
        </label>
      ))}
    </fieldset>
  );
}
