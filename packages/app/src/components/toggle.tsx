import { SkeletonBar } from "@firna/ui/skeleton";
import { createSwitchStyles, Switch } from "@firna/ui/switch";
import { useSharedUiTheme } from "@firna/ui/theme";
import { Body } from "@firna/ui/typography";

import { useCompact } from "../layout/viewport";

/**
 * An explicit on or off setting: its name, then the package switch, as the
 * catalogue's registered `switch` draws it. The name is the switch's own
 * accessible name, so a reader hears what they are turning on.
 *
 * While the setting's write runs, `working` is its working word, such as
 * "Saving…": a switch has no label of its own to carry it, so the word stands
 * in the switch's own row, beside its name, and the switch is disabled until
 * the write is done. The screen names the write for screen readers.
 */
export function Toggle({
  label,
  value,
  disabled,
  working,
  onChange,
  testID,
}: {
  label: string;
  value: boolean;
  disabled?: boolean;
  working?: string;
  onChange: (next: boolean) => void;
  testID?: string;
}) {
  const compact = useCompact();
  return (
    <div className="toggle-layout">
      {working === undefined ? (
        <Body>{label}</Body>
      ) : (
        <div className="toggle-working">
          <Body>{label}</Body>
          <Body color="muted">{working}</Body>
        </div>
      )}
      <Switch
        accessibilityLabel={label}
        value={value}
        disabled={disabled === true || working !== undefined}
        onValueChange={onChange}
        size={compact ? "lg" : "md"}
        testID={testID}
      />
    </div>
  );
}

/**
 * The setting while the read that decides its value runs: its name, which is
 * known, and a placeholder of the switch's track in the switch's own box, from
 * the package's own scale, because the answer decides the value.
 */
export function ToggleWait({ label }: { label: string }) {
  const compact = useCompact();
  const { pressable, track } = createSwitchStyles(
    useSharedUiTheme(),
    compact ? "lg" : "md",
  );
  return (
    <div className="toggle-layout">
      <Body>{label}</Body>
      <div
        className="fo-wait-control"
        style={{
          width: pressable.width,
          height: pressable.height,
          alignItems: "center",
          justifyContent: "center",
        }}
        aria-hidden="true"
      >
        <SkeletonBar
          width={track.width}
          height={track.height}
          radius={track.borderRadius}
        />
      </div>
    </div>
  );
}
