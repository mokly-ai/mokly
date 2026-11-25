import preview from "./.storybook/preview.js";

function Button({ label }: { label: string }) {
  return <button>{label}</button>;
}

const meta = preview.meta({ title: "Factory/Helper After", component: Button });
export const Primary = meta.story({ args: { label: "Primary" } });

export const SampleData = { label: "Sample" };
export function SampleLabel() {
  return "Sample";
}
