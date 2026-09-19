// The product-style Action control. It knows nothing about Mokly; the
// catalogue registration beside it in action.mokly.tsx adapts its props.
import { Button } from "@firna/ui/button";
import type { CSSProperties, ReactElement } from "react";

export type ActionTone = "primary" | "secondary";

export interface ActionProps {
  disabled: boolean;
  hint?: string;
  label: string;
  radius?: number;
  tone: ActionTone;
  /** Wraps the button, for example with a catalogue link. */
  wrap?: (button: ReactElement) => ReactElement;
}

const noop = (): void => undefined;

export function Action(props: ActionProps) {
  const button = (
    <Button disabled={props.disabled} onPress={noop} tone={props.tone}>
      {props.label}
    </Button>
  );
  return (
    <div
      className="example-action"
      style={
        props.radius === undefined
          ? undefined
          : ({ "--example-radius": `${props.radius}px` } as CSSProperties)
      }
    >
      {props.wrap ? props.wrap(button) : button}
      {props.hint === undefined ? null : (
        <p className="example-action-hint">{props.hint}</p>
      )}
    </div>
  );
}
