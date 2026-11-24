import type { ReactNode } from "react";

interface ButtonProps {
  primary?: boolean;
  backgroundColor?: string;
  size?: "small" | "medium" | "large";
  label: string;
  onClick?: () => void;
  icon?: ReactNode;
}

export function Button({
  primary = false,
  size = "medium",
  backgroundColor,
  label,
  icon,
  ...props
}: ButtonProps) {
  const mode = primary
    ? "storybook-button--primary"
    : "storybook-button--secondary";
  return (
    <button
      type="button"
      className={["storybook-button", `storybook-button--${size}`, mode].join(
        " ",
      )}
      style={{ backgroundColor }}
      {...props}
    >
      {icon}
      {label}
    </button>
  );
}
