function Label(props: { label: string }) {
  return <p>{props.label}</p>;
}

export default { title: "Label", component: Label, args: { label: "Story" } };

export const Primary = {};
