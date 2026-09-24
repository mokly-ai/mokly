import React from "react";

import { defineScreen } from "@mokly/mokly";

import { Card } from "./card.js";

export const mockups = [
  defineScreen({
    relatedDocs: ["notes.md"],
    description: "A screen discovered beside its component.",
    desktop: <Card>Co-located desktop</Card>,
    id: "packed-card",
    mobile: <Card>Co-located mobile</Card>,
    route: "screens/card.html",
    title: "Packed card",
    useCaseIds: [],
  }),
];
