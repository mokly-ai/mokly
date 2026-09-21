/**
 * The standalone catalogue's one Appearance control. It sets the interface and
 * the previews together, so a standalone document needs no separate preview
 * switch; an embedded root keeps its own controls instead.
 */

import { normalizeTheme } from "../viewer/theme.js";
import type { ViewerTheme } from "../viewer/types.js";

import { ChevronIcon, IconSvg } from "./icons.js";

const OPTIONS: readonly (readonly [ViewerTheme, string])[] = [
  ["auto", "Auto"],
  ["light", "Light"],
  ["dark", "Dark"],
];

/** Auto: a disc half filled, for an appearance the system decides. */
function AutoGlyph() {
  return (
    <IconSvg size={15}>
      <circle cx={12} cy={12} r={9} />
      <path d="M12 3a9 9 0 0 0 0 18z" fill="currentColor" strokeWidth={0} />
    </IconSvg>
  );
}

function LightGlyph() {
  return (
    <IconSvg size={15}>
      <circle cx={12} cy={12} r={4.5} />
      <path d="M12 2v2m0 16v2M2 12h2m16 0h2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </IconSvg>
  );
}

function DarkGlyph() {
  return (
    <IconSvg size={15}>
      <path d="M21 13a9 9 0 0 1-10-10 9 9 0 1 0 10 10z" />
    </IconSvg>
  );
}

const GLYPHS = { auto: AutoGlyph, light: LightGlyph, dark: DarkGlyph };

/**
 * Rendered hidden: the control cannot do anything until the startup asset
 * installs its behaviour, and CSS alone still gives the initial and Auto
 * appearance, so a reader without JavaScript is never shown a dead control.
 */
export function AppearanceSelect(props: { theme?: ViewerTheme }) {
  const value = normalizeTheme(props.theme);
  const Glyph = GLYPHS[value];
  return (
    <label className="mbk-appearance" hidden title="Appearance">
      <Glyph />
      <span className="mbk-appearance-value">
        {OPTIONS.find(([option]) => option === value)?.[1]}
      </span>
      <ChevronIcon size={12} />
      <select
        aria-label="Appearance"
        data-mokly-appearance-select=""
        defaultValue={value}
      >
        {OPTIONS.map(([option, label]) => (
          <option key={option} value={option}>
            {label}
          </option>
        ))}
      </select>
    </label>
  );
}
