import { InputFrame } from "@firna/ui/input";

import { icons } from "../../components/icons";
import { useCompact } from "../../layout/viewport";
import { PanelLead } from "../panel";

/** What the search finds, which names the field. */
const searchLabel = "Find a branch or pull request";

/**
 * The search that leads the switcher, in the panel's bar in place of the
 * visible title, as the catalogue's switcher draws it: the package's plain
 * field with the search glyph, which the field's own name labels for
 * assistive technology and shows as its placeholder. While the references
 * load or fail it keeps its place, disabled until there is something to
 * search, and it fades as a disabled control does.
 */
export function SwitcherSearch({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (next: string) => void;
  disabled: boolean;
}) {
  const compact = useCompact();
  return (
    <PanelLead>
      <div className={disabled ? "fo-canvas-search-off" : undefined}>
        <InputFrame
          nativeID="publication-search"
          accessibilityLabel={searchLabel}
          placeholder={searchLabel}
          prefixIcon={icons.search}
          variant="plain"
          size={compact ? "lg" : "md"}
          value={value}
          onChangeText={onChange}
          autoComplete="off"
          editable={!disabled}
          aria-disabled={disabled}
          tabIndex={disabled ? -1 : 0}
        />
      </div>
    </PanelLead>
  );
}
