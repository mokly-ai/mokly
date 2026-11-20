/** Every locale-sensitive call names a locale; Date formatting also names a time zone. */

import ts from "typescript";

import { access, memberName, unwrapped } from "./deterministic-access";
import { explicitTimeZone } from "./deterministic-date-policy";
import { isDateValue, signatureIdentity } from "./deterministic-types";
import type { Reject } from "./deterministic-types";

const methods = new Set([
  "toLocaleString",
  "toLocaleDateString",
  "toLocaleTimeString",
  "localeCompare",
]);
const intlConstructors = new Set([
  "Collator",
  "DateTimeFormat",
  "NumberFormat",
  "PluralRules",
  "RelativeTimeFormat",
  "ListFormat",
  "DisplayNames",
  "Segmenter",
  "Locale",
  "DurationFormat",
]);

export function checkLocale(
  node: ts.Node,
  checker: ts.TypeChecker,
  reject: Reject,
) {
  if (!(ts.isCallExpression(node) || ts.isNewExpression(node))) return;
  const signature = signatureIdentity(checker, node);
  const expression = unwrapped(node.expression);
  const method = memberName(expression) ?? signature.method;
  const called = access(expression);
  const intl =
    called?.startsWith("Intl.") && intlConstructors.has(called.slice(5))
      ? called
      : !signature.method && signature.constructorName?.startsWith("Intl.")
        ? signature.constructorName
        : undefined;
  if (!(intl || (method && methods.has(method)))) return;
  const args = node.arguments ?? [];
  const locale = args[method === "localeCompare" ? 1 : 0];
  if (!locale || !ts.isStringLiteral(unwrapped(locale)))
    reject(node, "locale-sensitive API requires a string-literal locale");
  const dateMethod =
    method?.startsWith("toLocale") &&
    (((ts.isPropertyAccessExpression(expression) ||
      ts.isElementAccessExpression(expression)) &&
      isDateValue(checker, expression.expression)) ||
      signature.constructorName === "Date");
  if (
    (dateMethod || intl === "Intl.DateTimeFormat") &&
    !explicitTimeZone(args[1])
  )
    reject(node, "Date formatting requires an explicit timeZone");
}
