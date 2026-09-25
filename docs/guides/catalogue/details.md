---
title: "Details"
description: "The evidence behind a screen, beside the screen."
section: "catalogue"
order: 4
---

## Open the inspector

The details inspector sits beside the screen. It starts collapsed and keeps
that choice across routes and reloads, so the catalogue opens the way you left
it.

## What it holds

- The screen's id, title, description and route.
- The tags it carries, as chips you can search from.
- The dependencies it declares and the related documents it names.
- Its components, and for a component page the screens that use it.
- The changed paths behind its status, including comparison evidence for an
  unchanged screen opened from All.

Catalogue-wide usage is explicitly unavailable until the background check has
finished; it is never shown as zero consumers.

## Stylesheet evidence

When a stylesheet you link has changed, the inspector names the changed styles
that can apply to this screen, or says the change can apply anywhere on it.
A stylesheet whose changed styles reach nothing on the screen is listed as
examined and excluded instead, and never produces a Changes row. Selector text
stays inside that secondary list, and a screen kept only by a stylesheet edit
reads "Styles this screen uses changed" above its comparison.

Screen-only catalogues show this evidence before you open a comparison.
Opening one keeps those details and adds the evidence it retained. The file
list combines changed files the screen uses with broader files that may affect
it. A listed file can leave the screen unchanged and out of Changes. Files
owned by a registered component or named by an exact dependency can still
add their entry.

## Component props

On a component page the inspector shows the saved variants and the declared
controls. While serving locally you can edit text, boolean, number and preset
controls and see the result immediately; Reset restores the saved variant. A
published catalogue keeps the variants and the inspection with the controls
read only.
