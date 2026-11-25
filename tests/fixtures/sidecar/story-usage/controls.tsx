import { forwardRef, memo } from "react";

interface ButtonProps {
  label: string;
  id?: string;
  onLabel?: () => string;
}

export function Button({ label, id, onLabel }: ButtonProps) {
  return <button id={id}>{onLabel?.() ?? label}</button>;
}

export const MemoButton = memo(Button);

export function Field(
  props: { label: string },
  ref?: React.Ref<HTMLInputElement>,
) {
  return <input ref={ref} aria-label={props.label} />;
}

export const ForwardField = forwardRef(Field);
