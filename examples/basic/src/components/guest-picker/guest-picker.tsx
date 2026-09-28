import { Button } from "@firna/ui/button";
import { useState } from "react";

export interface GuestPickerProps {
  initialCount: number;
  label: string;
  maximum: number;
}

export function GuestPicker(props: GuestPickerProps) {
  const [count, setCount] = useState(() =>
    Math.min(props.initialCount, props.maximum),
  );
  const remaining = props.maximum - count;
  return (
    <section className="example-guest-picker">
      <h2>{props.label}</h2>
      <p className="example-guest-picker-count">
        <output aria-live="polite" data-testid="guest-count">
          {count}
        </output>
        <span>attending</span>
      </p>
      <div className="example-guest-picker-actions">
        <Button
          disabled={count === 0}
          onPress={() => setCount((value) => Math.max(0, value - 1))}
          testID="remove-guest"
          tone="secondary"
        >
          Remove guest
        </Button>
        <Button
          disabled={count === props.maximum}
          onPress={() =>
            setCount((value) => Math.min(props.maximum, value + 1))
          }
          testID="add-guest"
          tone="primary"
        >
          Add guest
        </Button>
      </div>
      <p className="example-guest-picker-availability">
        {remaining} {remaining === 1 ? "place" : "places"} available
      </p>
    </section>
  );
}
