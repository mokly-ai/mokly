---
title: "Use-case flows"
description: "Put existing screens in order to show the path a person takes."
section: "authoring"
order: 6
---

## Define a flow

A use case is an ordered list of references to screens that already exist. It
never defines a screen inline.

```tsx
import { defineUseCase } from "@mokly/mokly";

export const accountTour = defineUseCase({
  id: "account-tour",
  title: "Account tour",
  description: "An ordered journey through the account screens.",
  route: "user-flows/account-tour.html",
  steps: [
    { screenId: "account-home" },
    { screenId: "account-invoice", title: "Open an invoice" },
  ],
  relatedDocs: ["docs/account.md"],
});
```

Use-case routes live under `user-flows/`. A step names the screen with
`screenId` and may add its own `title` and `description` for that moment in
the flow.

## Name the flow from a screen

A screen lists the flows it belongs to in `useCaseIds`, so the catalogue can
show that membership from either side.

```tsx
defineScreen({
  useCaseIds: ["account-tour"],
  // The rest of the screen is unchanged.
});
```

## How a flow behaves

The flow page shows its steps in order, each framing the document that screen
already publishes. A link whose destination is a use case opens the flow page.
When a screen changes, Changes carries that through to the flows it appears
in.

## Exported types

| Type                                | Use                                    |
| ----------------------------------- | -------------------------------------- |
| `UseCaseInput`, `UseCaseDefinition` | What `defineUseCase` takes and returns |
| `UseCaseStep`                       | One step of a flow                     |
