import { SkeletonBar } from "@firna/ui/skeleton";
import { createSwitchStyles, Switch } from "@firna/ui/switch";
import { useSharedUiTheme } from "@firna/ui/theme";
import { Body } from "@firna/ui/typography";

import { componentInput, componentMetadata } from "./metadata";
import { staticNoop } from "./static-controls";

/**
 * The switch while the read that decides its value runs: a placeholder of the
 * switch's track in the switch's own box, from the package's own scale at the
 * density the switch draws, because the answer decides the value.
 */
function SwitchPlaceholder({ size }: { size: "md" | "lg" }) {
  const { pressable, track } = createSwitchStyles(useSharedUiTheme(), size);
  return (
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
  );
}

export const switchInput = componentInput({
  ...componentMetadata("Switch", "An explicit on or off project setting."),
  propSchema: {
    type: "object",
    additionalProperties: false,
    required: ["label", "value"],
    properties: {
      label: { type: "string" },
      value: { type: "boolean" },
      disabled: { type: "boolean" },
      /**
       * The setting's write is running: its working word, such as "Saving…",
       * stands in the switch's own row beside its label, and the switch is
       * disabled until the write is done, because a switch has no label of
       * its own to carry the word.
       */
      working: { type: "string" },
      /**
       * The setting's waiting form while the read that decides its value
       * runs: its label, which is known, beside a placeholder of the switch.
       */
      waiting: { type: "boolean" },
    },
  },
  props: { label: "Require approval", value: false },
  controls: {
    label: { kind: "text" },
    value: { kind: "boolean" },
    disabled: { kind: "boolean" },
    working: { kind: "text" },
    waiting: { kind: "boolean" },
  },
  render: ({ label, value, disabled, working, waiting }, { viewport }) => {
    const size = viewport === "mobile" ? "lg" : "md";
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
        {waiting === true ? (
          <SwitchPlaceholder size={size} />
        ) : (
          <Switch
            accessibilityLabel={label}
            value={value}
            disabled={disabled === true || working !== undefined}
            onValueChange={staticNoop}
            size={size}
            testID="firna-switch"
          />
        )}
      </div>
    );
  },
  variants: [
    {
      slug: "off",
      title: "Off",
      props: { label: "Require approval", value: false },
    },
    {
      slug: "on",
      title: "On",
      props: { label: "Require approval", value: true },
    },
    {
      slug: "saving",
      title: "Saving",
      props: { label: "Require approval", value: true, working: "Saving…" },
    },
    {
      slug: "waiting",
      title: "Waiting",
      props: { label: "Require approval", value: false, waiting: true },
    },
  ],
});
