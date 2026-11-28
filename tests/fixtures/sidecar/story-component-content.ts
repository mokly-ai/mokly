export const contentNames = [
  "Count",
  "ForwardContent",
  "LinkButton",
  "NestedProp",
  "Only",
  "StringCase",
  "Tab",
  "Tabs",
  "TabsClone",
  "TabsRecreate",
  "Twice",
];

export const contentComponents = `
import React from "react";
import { Slot } from "@radix-ui/react-slot";
export function LinkButton({ children }) {
  return <Slot className="trigger" data-injected="true">{children}</Slot>;
}
export function Count({ children }) {
  return <div data-count={React.Children.toArray(children).length}>{children}</div>;
}
export function StringCase({ children }) {
  return <output data-is-string={String(typeof children === "string")}>{children}</output>;
}
export function Only({ children }) {
  return <div>{React.Children.only(children)}</div>;
}
export function NestedProp({ item }) {
  if (item instanceof Map) return <aside>{item.get("label")}{item.get("icon")}</aside>;
  return <aside data-self={String(item.self === item)}>{item.label}{item.icon}</aside>;
}
export function Tab({ label, children, selected }) {
  return <article data-selected={selected}>{label}{children}</article>;
}
export function Tabs({ children }) {
  return <section>{React.Children.toArray(children).filter((child) => child.type === Tab)}</section>;
}
export function ParentFilter({ children }) {
  return <section>{React.Children.toArray(children).filter((child) => child.type === Tab)}</section>;
}
export function TabsClone({ children }) {
  return <section>{React.Children.map(children, (child) => child.type === Tab
    ? React.cloneElement(child, { selected: "injected", label: "Injected" }) : null)}</section>;
}
export function TabsRecreate({ children }) {
  const child = React.Children.only(children);
  return <section><Tab {...child.props} selected="recreated" /></section>;
}
export function Twice({ children }) {
  return <div><section>{children}</section><aside>{children}</aside></div>;
}
export function ForwardContent({ children }) {
  return <Only>{children}</Only>;
}
`;

export const contentScreen = `
import { defineScreen } from "@mokly/mokly";
import { Slottable as Installed } from "@radix-ui/react-slot";
import { ${[...contentNames, "ParentFilter"].join(", ")} } from "./content.js";
const saved = <Installed><a href="/saved">Saved</a></Installed>;
const cases = {
  installed: () => saved,
  radix: () => <LinkButton><a href="/docs" className="link">Docs</a></LinkButton>,
  array: () => <Count>{[<i key="a">A</i>, "Text", <Tab key="b" label="Tab" />]}</Count>,
  text: () => <StringCase>Text</StringCase>,
  only: () => <Only><Tab label="Only" /></Only>,
  content: () => <Tabs><Tab key="a" label="A" /></Tabs>,
  filter: () => <ParentFilter><Tab key="a" label="A" /></ParentFilter>,
  clone: () => <TabsClone><Tab key="a" label="Before"><i>Body</i></Tab></TabsClone>,
  recreate: () => <TabsRecreate><Tab key="b" label="Recreate" /></TabsRecreate>,
  nested: () => <NestedProp item={{ label: "An icon", icon: <i>!</i> }} />,
  cycles: () => {
    const item = { label: "An icon", icon: <i>!</i> };
    item.self = item;
    return <NestedProp item={item} />;
  },
  map: () => <NestedProp item={new Map([["label", "An icon"], ["icon", <i>!</i>]])} />,
  repeat: () => <Twice><Tab key="b" label="Twice" /></Twice>,
  forward: () => <ForwardContent><Tab key="a" label="Forward" /></ForwardContent>,
  spread: () => <Tabs><Tab {...{ key: "With spread", label: "Spread" }} /></Tabs>,
};
export default defineScreen({
  title: "Content", description: "", relatedDocs: [],
  render({ scenario }) { return cases[scenario](); },
});
`;
