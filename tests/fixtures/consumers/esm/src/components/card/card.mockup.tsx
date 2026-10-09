import React from "react";

import { defineScreen } from "@mokly/mokly";

import { Card } from "./card.js";

export const mockups = [
  defineScreen({
    slug: "packed-card",
    relatedDocs: ["notes.md"],
    description: "A screen discovered beside its component.",
    desktop: <Card>Co-located desktop</Card>,
    path: "packed-card",
    mobile: <Card>Co-located mobile</Card>,
    title: "Packed card",
    useCasePaths: [],
  }),
];
