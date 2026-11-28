import type {
  ArrowFunctionExpression,
  ClassDeclaration,
  ClassExpression,
  Expression,
  FunctionDeclaration,
  FunctionExpression,
} from "@babel/types";

import type { StoryBodyEdits } from "./story-body-edits.js";

type Literal = ArrowFunctionExpression | FunctionExpression;
type ComponentFunction = Literal | FunctionDeclaration;

export function componentLiteral(value: Expression): Literal | undefined {
  if (
    value.type === "FunctionExpression" ||
    value.type === "ArrowFunctionExpression"
  )
    return value;
  if (value.type === "CallExpression") {
    const callee = value.callee;
    const name =
      callee.type === "Identifier"
        ? callee.name
        : callee.type === "MemberExpression" &&
            callee.property.type === "Identifier"
          ? callee.property.name
          : undefined;
    const first = value.arguments[0];
    if ((name === "memo" || name === "forwardRef") && first)
      if (
        first.type !== "SpreadElement" &&
        first.type !== "ArgumentPlaceholder"
      )
        return componentLiteral(first);
  }
}

/** Move the original parameter list and body together. Only insert text. */
export function instrumentFunction(
  edits: StoryBodyEdits,
  fn: ComponentFunction,
  self: string,
  helper: string,
): void {
  let count = 0;
  for (const param of fn.params) {
    if (param.type === "AssignmentPattern" || param.type === "RestElement")
      break;
    if (param.type === "Identifier" && param.name === "this") continue;
    count++;
  }
  const parameters = Array.from(
    { length: count },
    (_, index) => `${helper}Arg${index}`,
  );
  if (fn.type === "ArrowFunctionExpression") {
    const rest = [...parameters, `...${helper}Rest`].join(",");
    edits.insert(
      fn.start!,
      `(${rest})=>${helper}.body(${self},void 0,[${rest}],`,
    );
    edits.insert(fn.end!, ")");
    return;
  }
  const head =
    fn.typeParameters?.start ??
    edits.token("(", fn.id?.end ?? fn.start!, fn.body.start!).start;
  const inner = fn.async ? "async function" : "function";
  edits.insert(
    head,
    `(${parameters.join(",")}){return ${helper}.body(${self},this,arguments,${inner} `,
  );
  edits.insert(fn.end!, ",new.target);}");
}

export function instrumentClass(
  edits: StoryBodyEdits,
  node: ClassDeclaration | ClassExpression,
  self: string,
  helper: string,
): boolean {
  const render = node.body.body.find(
    (member) =>
      member.type === "ClassMethod" &&
      !member.static &&
      member.kind === "method" &&
      !member.generator &&
      !member.async &&
      (member.key.type === "Identifier" && !member.computed
        ? member.key.name === "render"
        : member.key.type === "StringLiteral" && member.key.value === "render"),
  );
  if (!render || render.type !== "ClassMethod") return false;
  edits.insert(
    render.body.start! + 1,
    `return ${helper}.classBody(${self},this,()=>{`,
  );
  edits.insert(render.body.end! - 1, "});");
  return true;
}
