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
// specs/account/account-tour.mockup.tsx
import { defineUseCase } from "@mokly/mokly";

export default defineUseCase({
  title: "Account tour",
  description: "An ordered journey through the account screens.",
  steps: [
    { screenPath: "./account-home" },
    { screenPath: "account/billing/invoice", title: "Open an invoice" },
  ],
  relatedDocs: ["docs/account.md"],
});
```

The flow's path is `account/account-tour`, derived from its file like every
entry, and its address is `/view/account/account-tour/`. A step names the
screen with `screenPath`, either the complete path or a path relative to the
flow's own folder starting with `./` or `../`, and may add its own `title`
and `description` for that moment in the flow. A step may name a screen
variant; it cannot name a page or a document.

## Name the flow from a screen

A screen lists the flows it belongs to in `useCasePaths`, so the catalogue can
show that membership from either side. The two lists must agree: every step
names a screen that lists the flow, and every listed flow steps through the
screen.

```tsx
// specs/account/account-home.mockup.tsx
import { defineScreen } from "@mokly/mokly";

export default defineScreen({
  title: "Account home",
  description: "The start of the account tour.",
  mobile: <main>Account</main>,
  desktop: <main>Account</main>,

  relatedDocs: [],
  useCasePaths: ["./account-tour"],
});
```

The invoice screen also lists this flow. In its existing definition at
`specs/account/billing/invoice.mockup.tsx`, set
`useCasePaths: ["../account-tour"]` so both steps have reciprocal membership.

A variant never inherits its parent's flows; list a flow on the variant when
a step names the variant.

## How a flow behaves

The flow page shows its steps in order, each framing the document that screen
already publishes; the flow writes no document of its own. A link whose
destination is a use case opens the flow page. When a screen changes, Changes
carries that through to the flows it appears in, and moving a screen to a new
path means updating the steps and memberships that name it, because a step
that names a path with no screen fails the build. The error names the
missing path; it does not detect where a screen moved.

## Exported types

| Type                                | Use                                    |
| ----------------------------------- | -------------------------------------- |
| `UseCaseInput`, `UseCaseDefinition` | What `defineUseCase` takes and returns |
| `UseCaseStep`                       | One step of a flow                     |
