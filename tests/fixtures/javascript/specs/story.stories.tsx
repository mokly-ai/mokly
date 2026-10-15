function Label(props: { label: string; count: number }) {
  return (
    <p>
      {props.label}: {props.count}
    </p>
  );
}

export default {
  title: "Fixtures/Story label",
  component: Label,
  args: { label: "Story", count: 2, onSelect: () => {} },
  argTypes: {
    label: {
      options: ["Story", "Other"],
      name: "Story label",
      description: "Choose a label",
    },
    count: { control: { min: 0, max: 10, step: 2 } },
    onSelect: { action: "select" },
  },
};

export const Alternate = {
  name: "Other story",
  args: { label: "Other", count: 4 },
};
