# Storybook Story Failures

Status: A story that cannot render still stops the build, and Mokly writes no error document yet. The [story render failures milestone](../../plans/storybook-support.md#milestone-24-story-render-failures) adds the failed views, their warning, and their error document.

This page continues the [Storybook stories contract](./mokly-storybook.md). It
defines what Mokly does when a story cannot render.

## Failed Views

A story render fails when the story's own work throws. This work is the
composition of the story, the preview's `beforeAll` hook, the story's loaders
and `beforeEach` hooks, the cleanups of these hooks, and the render itself.
For example, a story whose render reads `document`, such as a portal into
`document.body`, fails on the server with `document is not defined`. The
[story setup rules](./mokly-storybook-setup.md#setup-before-render) define
when each hook and each cleanup runs.

A failed view is a saved view of a stories entry whose story render fails.
The saved views of a stories entry are the views of its parent page, which
render the first included story, and the views of each variant page, which
render the story of the variant, under the
[entry rules](./mokly-storybook.md#the-entry-and-its-variants). A saved view
can fail in `build`, in `publish`, in the on-demand and background renders of
Serve, and on both sides of Changes.

A failed view does not stop the build. The document of a failed view is an
[error document](#the-error-document) in place of the story. Each failed view
gives one [warning](#the-warning).

Decision: a story that cannot render gives a failed view, and `--strict` still
fails, so reviewers see each failed story in place. The `!mokly` tag alone,
with which a failure still stops the build, was rejected, and so was a
catalogue that leaves the failed views out.

A failure that is not the story's own work keeps its code and its outcome
under the [fail-closed rules](./mokly-sidecar.md#fail-closed-rules), also in a
story render. These failures include `render-timeout`, `sidecar-crashed`,
`bundle-failed`, and the protocol failures, such as `sidecar-protocol`.

Decision: only the story's own work gives a failed view, because a timeout or
a crash replaces the sidecar process. A failed view for a timeout was
rejected, because a story that hangs would then cost the deadline twice for
each of its views.

## Live Props Renders

A live props render is a render of edited props for the Props tab, through the
temporary preview route of Serve. It is not a saved view. When a live props
render of a story fails, Serve answers with the generic `render-failed`
preview failure of the
[component controls contract](./mokly-component-controls.md#request-and-lifecycle-rules),
with HTTP 422. The Props tab then shows its failure alert.

Decision: a live props render gives no error document, and the Props tab names
the preview that it shows under the
[controls design](./mokly-component-controls-design.md#controls-panel). An
error document on the live route was rejected, because the live route keeps
its failures generic.

## The Warning

Each failed view gives one `story-render-failed`
[build warning](./mokly-build-warnings.md#record). Its route is the document
route of the view. Its message is:

```text
story <JSON-quoted-story-id> could not render; add the "!mokly" tag to leave it out: <reason>
```

The story id is the id of the story that the view renders: the file path,
`#`, and the export name, under the
[entry rules](./mokly-storybook.md#the-entry-and-its-variants). `<reason>` is
the [reason](#the-reason) of the failure, with its lines joined by single
spaces. For example:

```text
story "src/components/Menu.stories.tsx#Expanded" could not render; add the "!mokly" tag to leave it out: document is not defined
```

A document that Mokly reuses from an earlier render keeps its warning, as
every reused document does under the
[producer rules](./mokly-build-warnings.md#producers-and-transport).

Decision: one code covers every failed view. The route names the view, and
the reason comes last, because its length varies.

## Strict Mode

`--strict` counts `story-render-failed` under
[strict mode](./mokly-build-warnings.md#strict-mode). So a strict `build` or
`publish` fails when it has a failed view.

## The Reason

The reason is the message of the thrown error. For a thrown value that is not
an error, the reason is the string of that value. When the message is empty,
the reason is the name of the error, such as `Error`. The reason holds no
stack.

The reason holds no absolute path. Mokly changes each absolute path and each
`file:` URL in it:

- A path inside the side's source root reads relative to that root. That root
  is the repository root on the head side and the extracted base commit on the
  base side.
- A path inside a selected dependency root reads as its
  [logical name](./mokly-sidecar.md#bundling), such as
  `node_modules/pkg/index.js`.
- Each other absolute path or `file:` URL becomes `…`.

So one failure gives the same reason, and the same error document, on both
sides of Changes and on every machine.

Decision: the reason holds no absolute path, because the checkout folder is
not an input, and identical inputs give identical bytes.

## The Error Document

The error document follows the
[document assembly](./mokly-rendering.md#document-assembly) of a story
document, with these differences:

- Its head links no stylesheet. So it has no entry of the
  [stylesheet list](./mokly-rendering.md#renderer-stylesheets): no configured
  stylesheet, no stylesheet of the view's colour scheme, no component
  stylesheet, and no CSS of the renderer module or of the stories file. It
  also has no CSS of the preview file.
- Its head holds no collected style element.
- Its head holds one style element of its own. This element uses only the
  system colours `Canvas`, `CanvasText`, and `GrayText`.
- Its body holds the empty root region of the view, and then the error text.

Its `html` element carries the colour scheme of its view, as every document
does. The system colours follow that scheme, so a dark view shows a dark
error document. Project CSS cannot change the look of the error document. A
change of project CSS does not mark a failed view as changed.

Decision: the error document carries only its own styles, with system colours
that follow the scheme of its view, so it reads the same in every project and
matches its frame. An error document that is always light was rejected,
because a dark view then shows a light document, and so were the project
stylesheets of the view, because project CSS, such as a reset, can break it.

The error text holds these parts, in this order:

1. The title `The <story name> story couldn’t render`, with the typographic
   apostrophe `’`. The story name is the Storybook name of the story that the
   view renders, under the
   [name rules](./mokly-storybook.md#names-tags-and-the-description). On the
   parent page it is the name of the first included story, such as
   `Collapsed`. On a variant page it is the name of the story of the variant,
   such as `Expanded`.
2. The sentence
   `Add the !mokly tag to this story to leave it out of the catalogue.`, with
   `!mokly` in a `code` element.
3. The label `Reason`, and then the reason in a `code` element. The line
   breaks of the reason stay visible.

Mokly escapes all text of the error document as HTML. The
[component explorer design](./mokly-component-design.md#storybook-stories)
shows the error document in its frames.

## Usage

A failed view has an explicit empty usage record, so its usage is `ready`.
The record has an empty root region, as a null render has under the
[usage record contract](./mokly-component-usage-records.md#root-output-boundary).
The error text lies outside that region. Highlight components then says
`No registered components are used in this view.` Every Used by and Affected
list of the catalogue stays complete.

Decision: a failed view has an empty usage record, because a null render
already gives an empty region. A failed view without usage was rejected,
because then no Used by or Affected list is complete while one story fails.

## Changes

Changes compares the error document as the document of the failed view,
under the [view rules of Changes](./mokly-changes.md#entries-and-views). So a
story that renders at the branch point and fails on the branch is an ordinary
changed view: Before shows the base render, and Current shows the error
document. When both sides fail with the same reason, the two error documents
are equal, so the view is unchanged.

A failed view on the base side does not make Changes unavailable. Every other
failure of a base render keeps its outcome under
[base preparation](./mokly-base-preparation.md#shared-render-runtime). A
failed view on the base side gives no reported warning, because base
composition warnings are not current-build warnings under the
[reporting rules](./mokly-build-warnings.md#reporting).

## Serve

Serve answers the document route of a failed view with its error document and
HTTP 200, as for every other document. So the
[failed render rule](./mokly-on-demand.md#foreground-documents) of on-demand
Serve, which answers 500, does not apply to a failed view. Serve reports the
warning of a failed view under the
[attempt rules](./mokly-build-warnings.md#watched-serve-generations), for
on-demand and background renders alike.

## Related Docs

- [Storybook stories](./mokly-storybook.md)
- [Storybook story setup](./mokly-storybook-setup.md)
- [Render sidecar](./mokly-sidecar.md)
- [Build warnings](./mokly-build-warnings.md)
- [Rendering and document assembly](./mokly-rendering.md)
- [Component usage records](./mokly-component-usage-records.md)
- [Component explorer design](./mokly-component-design.md)
