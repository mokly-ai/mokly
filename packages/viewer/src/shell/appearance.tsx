/**
 * The standalone catalogue's one Appearance control. It sets the interface and
 * the previews together, so a standalone document needs no separate preview
 * switch; an embedded root keeps its own controls instead.
 */

import type { ViewerTheme } from "../viewer/types.js";

import { ChevronIcon, IconSvg } from "./icons.js";
import { useShellIdentifier } from "./identifier_context.js";
import { ViewChangedMark } from "./view_changed_mark.js";
import { VIEW_CHANGED_IDS } from "./view_marks.js";
import { useActiveWorkspace } from "./workspace_context.js";

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
export function AppearanceSelect(props: {
  ready: boolean;
  theme: ViewerTheme;
}) {
  const value = props.theme;
  const changed = useActiveWorkspace()?.marks.scheme ?? false;
  const changedId = useShellIdentifier(VIEW_CHANGED_IDS.scheme);
  return (
    <label
      className="mbk-appearance"
      data-appearance-value={value}
      data-mokly-appearance-control=""
      hidden={!props.ready}
      title="Appearance"
    >
      {OPTIONS.map(([option, label]) => {
        const OptionGlyph = GLYPHS[option];
        return (
          <span
            className="mbk-appearance-option"
            data-appearance-option={option}
            key={option}
          >
            <OptionGlyph />
            <span className="mbk-appearance-value">{label}</span>
          </span>
        );
      })}
      <ChevronIcon size={12} />
      <select
        aria-describedby={changed ? changedId : undefined}
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
      <ViewChangedMark id={changedId} kind="scheme" marked={changed} />
    </label>
  );
}
