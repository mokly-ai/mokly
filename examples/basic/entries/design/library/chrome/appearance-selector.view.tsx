import {
  AutoAppearanceIcon,
  ChevronDownIcon,
  DarkAppearanceIcon,
  LightAppearanceIcon,
} from "../../parts/icons.js";
import { useDesignStyle } from "../style_context.js";

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
}: AppearanceSelectorProps) {
  useDesignStyle("appearance-selector");
  const Glyph = glyphs[value];
  const selected = options.find(([id]) => id === value);
  return (
    <label
      className="mbk-appearance"
      data-appearance-value={value}
      data-compact={compact ? "" : undefined}
      title="Appearance"
    >
      <Glyph size={15} />
      <span className="mbk-appearance-value">{selected?.[1] ?? "Auto"}</span>
      <ChevronDownIcon size={12} />
      <select aria-label="Appearance" defaultValue={value}>
        {options.map(([id, label]) => (
          <option key={id} value={id}>
            {label}
          </option>
        ))}
      </select>
    </label>
  );
}
