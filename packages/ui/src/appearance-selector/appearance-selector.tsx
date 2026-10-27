/**
 * The standalone catalogue's one Appearance control: Auto, Light, or Dark. It
 * sets the interface and the previews together, so a standalone document
 * needs no separate preview switch.
 */

import { ChangeMark } from "../change-mark/change-mark.js";
import { ChevronIcon, IconSvg } from "../icons/icons.js";

/** An interface appearance; Auto follows the reader's system. */
export type Appearance = "auto" | "light" | "dark";

const OPTIONS: readonly (readonly [Appearance, string])[] = [
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

/** The option the select names, or nothing for a value it does not offer. */
function appearanceOf(value: string): Appearance | undefined {
  return OPTIONS.find(([option]) => option === value)?.[0];
}

/**
 * A native select laid over the face of the current appearance. Every face is
 * rendered and the stylesheet reveals the one `data-appearance-value` names, so
 * a script that applies a choice changes the face by setting one attribute.
 * The select is uncontrolled: `value` is its first choice, and `onChange`
 * reports each choice the reader makes.
 */
export function AppearanceSelector(props: {
  /** The appearance the control shows. */
  value: Appearance;
  /** Whether a changed view uses the other scheme, which marks the control. */
  changed: boolean;
  /** The id of the mark's wording, unique in the document. */
  changedId: string;
  /** The mark's wording, such as `Other theme changed`. */
  changedText: string;
  /** Hide the control, for example until a script that applies a choice runs. */
  hidden?: boolean;
  /** Receives each appearance the reader chooses. */
  onChange?: (value: Appearance) => void;
}) {
  return (
    <label
      className="mbk-appearance"
      data-appearance-value={props.value}
      data-mokly-appearance-control=""
      hidden={props.hidden}
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
        aria-describedby={props.changed ? props.changedId : undefined}
        aria-label="Appearance"
        data-mokly-appearance-select=""
        defaultValue={props.value}
        onChange={(event) => {
          const choice = appearanceOf(event.currentTarget.value);
          if (choice) props.onChange?.(choice);
        }}
      >
        {OPTIONS.map(([option, label]) => (
          <option key={option} value={option}>
            {label}
          </option>
        ))}
      </select>
      <ChangeMark
        id={props.changedId}
        kind="scheme"
        marked={props.changed}
        text={props.changedText}
      />
    </label>
  );
}
