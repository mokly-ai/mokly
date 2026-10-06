import { isValidElement, type ReactNode } from "react";

import type { ComponentPropsData } from "@mokly/viewer";
import {
  DataBudget,
  invalidData,
  plainKeys,
  validateProps,
} from "@mokly/viewer/data";

import type { ComponentDefinition } from "./types.js";

/** Split data from optional React slots without evaluating any property accessor. */
export function componentInputs(
  definition: ComponentDefinition,
  input: unknown,
  at: string,
): { data: ComponentPropsData; slots: Record<string, ReactNode> } {
  const keys = plainKeys(input, at);
  const props = input as Record<string, unknown>;
  const data: Record<string, unknown> = {};
  const slots: Record<string, ReactNode> = {};
  for (const key of keys) {
    if (definition.slots.includes(key)) {
      validateSlot(props[key], `${at}.${key}`);
      if (props[key] !== undefined) slots[key] = props[key] as ReactNode;
    } else data[key] = props[key];
  }
  return { data: validateProps(definition.propSchema, data, at), slots };
}

function validateSlot(value: unknown, at: string): void {
  const budget = new DataBudget();
  function visit(node: unknown, depth: number): void {
    budget.visit(depth, at);
    if (
      node === null ||
      node === undefined ||
      typeof node === "string" ||
      typeof node === "boolean" ||
      typeof node === "bigint" ||
      (typeof node === "number" && Number.isFinite(node)) ||
      isValidElement(node)
    )
      return;
    if (Array.isArray(node)) {
      node.forEach((item) => visit(item, depth + 1));
      return;
    }
    invalidData(at, "slot must contain a renderable React node");
  }
  visit(value, 0);
}
