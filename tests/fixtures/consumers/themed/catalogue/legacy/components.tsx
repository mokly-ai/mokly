import { FirnaCard } from "@firna/ui";
import React from "react";

export function renderComponent(
  name: string,
  attributes: Readonly<Record<string, string>>,
) {
  if (name !== "notice") return "";
  return <FirnaCard accent="#3157d5">{attributes["label"]}</FirnaCard>;
}
