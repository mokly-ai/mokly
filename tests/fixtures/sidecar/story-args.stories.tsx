import type { Meta, StoryObj } from "@storybook/react";
import type { ReactNode } from "react";
import { fn } from "storybook/test";

interface ButtonProps {
  label: string;
  icon?: ReactNode;
  icons?: ReactNode[];
  onClick?: () => void;
  callback?: () => void;
  hidden?: string;
  tableHidden?: string;
  action?: string;
  functionArg?: string;
  empty?: string[];
}

function Button({ label, icon, icons, onClick, callback }: ButtonProps) {
  return (
    <button onClick={onClick}>
      {label}
      {icon}
      {icons}
      {typeof callback === "function" ? " callback" : ""}
    </button>
  );
}

const meta = {
  component: Button,
  args: { label: "Meta", onClick: fn(), icon: <span>Icon</span> },
  argTypes: {
    hidden: { control: false },
    tableHidden: { table: { disable: true } },
    action: { action: "action" },
    functionArg: { type: "function" },
  },
} satisfies Meta<typeof Button>;
export default meta;

export const DataOnly: StoryObj<typeof meta> = {
  args: {
    label: "Story",
    icons: [<i key="icon">Array icon</i>],
    callback: fn(),
    hidden: "Hidden",
    tableHidden: "Hidden table",
    action: "Action",
    functionArg: "Function hint",
    empty: [],
  },
};
