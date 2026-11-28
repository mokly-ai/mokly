export const identityNames = [
  "Declared",
  "Arrow",
  "Default",
  "Renamed",
  "Memo",
  "Forward",
  "Nested",
  "ClassView",
  "Hoc",
  "Compound",
  "Item",
  "Self",
  "Base",
  "Sub",
  "Cycle",
];

export const identityComponents = `
import React, { forwardRef, memo } from "react";
const captured = Declared;
export function Declared() { return <b>declaration</b>; }
Declared.displayName = "Original";
Declared.late = 4;
export const Arrow = () => <b>arrow</b>;
export default function () { return <b>default</b>; }
function lower() { return <b>alias</b>; }
export { lower as Renamed };
export const Memo = memo(() => <b>memo</b>);
export const Forward = forwardRef((props, ref) => <b>forward</b>);
export const Nested = memo(forwardRef(function Inner(props, ref) {
  return <b>nested</b>;
}));
export class ClassView extends React.Component {
  static count = 1;
  render() {
    return <b data-self={String(this.constructor === ClassView)}>{ClassView.count}</b>;
  }
}
function makeView(text) { return () => <b>{text}</b>; }
export const Hoc = makeView("hoc");
function Root({ children }) { return <div>{children}</div>; }
export function Item() { return <b>item</b>; }
export const Compound = Object.assign(Root, { Item });
export const Self = function Local({ children }) {
  return <b>{String((<Local />).type === Local)}{children}</b>;
};
export class Base extends React.Component {
  label() { return "base"; }
  render() { return <b>{this.label()}</b>; }
}
export class Sub extends Base {
  label() { return "sub:" + super.label(); }
}
export const Constant = 19;
export const Record = Object.freeze({ number: 2 });
export function Helper(first, second = 2) { return [this.tag, first * second, arguments.length]; }
export class Utility {
  constructor(value) { this.value = value; }
  render() { return this.value; }
}
export function localChecks() {
  const Alias = lower;
  return [
    captured === Declared, (<Declared />).type === Declared,
    (<Arrow />).type === Arrow, (<Alias />).type === lower,
    (<Memo />).type === Memo, (<Forward />).type === Forward,
    (<Nested />).type === Nested, (<ClassView />).type === ClassView,
    (<Hoc />).type === Hoc, Compound === Root, Compound.Item === Item,
    Base.prototype.label.call({}) === "base",
  ];
}
`;

export const identityScreen = `
import { defineScreen } from "@mokly/mokly";
import { ${identityNames.join(", ")} } from "./barrel.js";
import * as secondImport from "./barrel.js";
import { Constant, Record, Helper, Utility, localChecks } from "./components.js";
import { seesSame } from "./cycle.js";
export default defineScreen({
  title: "Identity", description: "", relatedDocs: [],
  render() {
    const shared = [${identityNames
      .map(
        (name) =>
          `(<${name} />).type === ${name} && secondImport.${name} === ${name}`,
      )
      .join(", ")}];
    Declared.displayName = "Changed";
    secondImport.Declared.late += 1;
    ClassView.count += 1;
    const ordinary = new Utility(8);
    return <main data-identity={String([...localChecks(), ...shared, seesSame()].every(Boolean))}
      data-statics={[secondImport.Declared.displayName, Declared.late, secondImport.ClassView.count].join(",")}
      data-utility={[Constant, Record.number, ordinary instanceof Utility, ordinary.render(), Helper.length, Helper.call({ tag: "tag" }, 3).join(":")].join(",")}>
      ${identityNames.map((name) => `<${name} />`).join("\n")}
    </main>;
  },
});
`;
