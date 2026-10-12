import { useId } from "react";

import {
  AutoAppearanceIcon,
  ChevronDownIcon,
  DarkAppearanceIcon,
  LightAppearanceIcon,
} from "../../parts/icons.js";

import type { AppearanceSelectorProps } from "./appearance-selector.js";

const options = [
  ["auto", "Auto"],
  ["light", "Light"],
  ["dark", "Dark"],
] as const;

const glyphs = {
  auto: AutoAppearanceIcon,
  light: LightAppearanceIcon,
  dark: DarkAppearanceIcon,
};

export function AppearanceSelectorView({
  value,
  compact,
  otherSchemeChanged,
}: AppearanceSelectorProps) {
  const changedId = useId();
  return (
    <label
      className="mbk-appearance"
      data-appearance-value={value}
      data-compact={compact ? "" : undefined}
      data-mokly-appearance-control=""
      title="Appearance"
    >
      {options.map(([id, label]) => {
        const Glyph = glyphs[id];
        return (
          <span
            className="mbk-appearance-option"
            data-appearance-option={id}
            key={id}
          >
            <Glyph size={15} />
            <span className="mbk-appearance-value">{label}</span>
          </span>
        );
      })}
      <ChevronDownIcon size={12} />
      <select
        aria-describedby={otherSchemeChanged ? changedId : undefined}
        aria-label="Appearance"
        data-mokly-appearance-select=""
        defaultValue={value}
      >
        {options.map(([id, label]) => (
          <option key={id} value={id}>
            {label}
          </option>
        ))}
      </select>
      {otherSchemeChanged ? (
        <>
          <span
            aria-hidden="true"
            className="mbk-view-changed"
            data-view-changed="scheme"
          />
          <span className="mbk-view-changed-text" id={changedId}>
            Other theme changed
          </span>
        </>
      ) : null}
    </label>
  );
}
