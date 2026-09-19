---
title: "Review-ignore"
description: "Keep repeated chrome out of a comparison without hiding it from the reader."
section: "authoring"
order: 9
---

## Mark repeated chrome

A shared header or navigation shell repeats on every screen, so one edit to it
would otherwise mark the whole catalogue as changed. `ReviewIgnore` marks that
region with paired inert boundaries and no layout wrapper of its own.

```tsx
import { ReviewIgnore } from "@mokly/mokly";

<ReviewIgnore id="app-shell">
  <AppHeader />
</ReviewIgnore>;
```

The id is lowercase kebab-case and unique within a generated document.
Ignoring changes only how a difference is classified: the stored documents and
both sides of a comparison keep the real content. Ignored-only changes are
grouped by id, viewport and color scheme instead of listing every screen that
contains them. Never ignore the content the screen is about.

## Keep stateful chrome honest

When the repeated region renders from state, give it a material key derived
from the typed props it rendered with. The signal sits outside the ignored
region and stays part of classification, so a real change to that state is
still reviewed.

```tsx
import { ReviewIgnore, reviewMaterialKey } from "@mokly/mokly";

<ReviewIgnore id="app-shell" materialKey={reviewMaterialKey({ unread: 3 })}>
  <AppHeader unread={3} />
</ReviewIgnore>;
```

`reviewMaterialKey` hashes plain structured data into a deterministic key.
Malformed, duplicate, nested, overlapping or mismatched signals fail the build
with the route that caused them.

## Turn markers off for a subtree

`ReviewIgnoreScope` enables or disables the markers for everything it wraps,
which is how a screen that is about the shell itself compares it in full.

```tsx
import { ReviewIgnoreScope } from "@mokly/mokly";

<ReviewIgnoreScope enabled={false}>
  <AppHeader />
</ReviewIgnoreScope>;
```
