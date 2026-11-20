/** Date reads need explicit values and UTC interpretation. */

import ts from "typescript";

import { unwrapped } from "./deterministic-access";

/** Local calendar reads and writes vary with the build time zone. */
export const localDateMembers = new Set([
  "getHours",
  "getDate",
  "getDay",
  "getMonth",
  "getFullYear",
  "getMinutes",
  "getSeconds",
  "getMilliseconds",
  "getTimezoneOffset",
  "getYear",
  "setHours",
  "setDate",
  "setMonth",
  "setFullYear",
  "setMinutes",
  "setSeconds",
  "setMilliseconds",
  "setYear",
  "toDateString",
  "toTimeString",
]);

/** Require the date-format call to name its time zone in its options. */
export function explicitTimeZone(options: ts.Expression | undefined): boolean {
  const value = options && unwrapped(options);
  return (
    !!value &&
    ts.isObjectLiteralExpression(value) &&
    value.properties.some((property) => {
      if (ts.isShorthandPropertyAssignment(property))
        return property.name.text === "timeZone";
      if (!ts.isPropertyAssignment(property)) return false;
      const initializer = unwrapped(property.initializer);
      return (
        (ts.isIdentifier(property.name) ||
          ts.isStringLiteralLike(property.name)) &&
        property.name.text === "timeZone" &&
        !(ts.isIdentifier(initializer) && initializer.text === "undefined") &&
        initializer.kind !== ts.SyntaxKind.NullKeyword
      );
    })
  );
}
