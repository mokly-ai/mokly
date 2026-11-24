# Mockup Catalogue Contract

The catalogue uses the workspace `@mokly/mokly` and `@mokly/ui` packages.
Product UI follows its reviewed mockups. The
[authoring guide](../../mockups/README.md), [tokens](./design-tokens.md),
[site design](./site-design.md), and [copy rules](./product-copy.md) are part
of this specification.

## Package And Ownership

- Use the `@mokly/mokly` and `@mokly/ui` packages of this repository, not
  published releases. The one npm workspace lockfile links every consumer to
  the package under `packages/`, so a Mokly change and the catalogue change
  that it needs land together. React and React DOM install once, at one exact
  version that satisfies the packages' React 19 requirement. The decision is in
  [Repository layout](../repository-layout.md#boundary).
- Use public `@mokly/mokly` exports for authoring and public `@mokly/ui`
  subpaths for the viewer drawings. Source protection, component
  usage capture, navigation rewriting and the Browse shell belong to the Mokly
  packages. Do not fork them or import `dist/` internals.
- Mokly writes nothing into the repository except the output directory of a
  build and its reservation directory, and Git ignores both. No
  output lives under `docs/mockups`. Commit authored source,
  styles and assets only. [Mockup tooling](./mockup-tooling.md) defines the
  commands and their output.
- The viewer family composes `@mokly/ui` parts as static depictions.
  [Product mockups: viewer](./product-mockups-viewer.md#viewer)
  defines the drawing, its overlay and its access cards.
- The cloud owns its renderer, tokens, styles, components, screen definitions,
  policy tests, and screenshot evidence. A Mokly change that changes an upload
  artifact regenerates the `mkc-mokly-contract` fixtures in the same change.
- Use the repository's exact toolchain pins.

## Configuration And Scripts

[Mockup tooling](./mockup-tooling.md) defines the data-only configuration, its
roots and entry-route stylesheet rules, the imported package styles, the build
output and the commands. [Mockup baselines](./mockup-baselines.md) defines the
comparison base. Mokly renders the base from the base commit's sources, so the
configuration names no rebuild recipe.

## Catalogue Hierarchy

Every entry has one case-preserved path derived from its discovered root,
directories and exporting file slug. There is no authored `id` or `navPath`.
Use the [entry-path grammar](./publication-review.md#versions-and-entry-paths)
and reject duplicate or case-colliding paths.

One root scans `docs/mockups/src/entries` with
`files: ["**/*.mockup.{ts,tsx}"]`; no Markdown document is discovered.
The source tree is the path tree. A directory-owning screen uses
`index.mockup.tsx`; index collapses its filename segment.
Each index has at least one sibling entry module directly beside it; variants
and nested files do not count. Repeated `<name>/<name>.mockup.tsx` owners are
invalid. Canonical entries never author `path`; the package's path override
exists for other consumers. This root has no index entry.
No title, export name or kind changes identity.

| Source below `src/entries/`                  | Entry path                       |
| -------------------------------------------- | -------------------------------- |
| `design/tokens.mockup.tsx`                   | `design/tokens`                  |
| `design/button.mockup.tsx`                   | `design/button`                  |
| `design/email/sign-in.mockup.tsx`            | `design/email/sign-in`           |
| `design/site/home.mockup.tsx`                | `design/site/home`               |
| `product/account/sign-in/index.mockup.tsx`   | `product/account/sign-in`        |
| `product/settings/billing/index.mockup.tsx`  | `product/settings/billing`       |
| `product/settings/billing/trial.mockup.tsx`  | `product/settings/billing/trial` |
| `product/viewer/standalone/index.mockup.tsx` | `product/viewer/standalone`      |
| `flows/product-browse.mockup.tsx`            | `flows/product-browse`           |

A single-file screen may keep its filename when that already gives the desired
leaf. Directory owners use `index.mockup.tsx`. The three product flows live in
`flows/product-onboarding.mockup.tsx`, `flows/product-browse.mockup.tsx` and
`flows/product-invitation.mockup.tsx`.

Each parent draws its canonical screen. Its at most four states use required
`slug` values such as `empty`, `loading`, `error`, in authored order. Each
state is a variant that overrides top-level props of its parent, such as a
state prop, and shares the parent's render instead of declaring its own.
A variant path is `<parent-path>/<slug>`; variant `index` does
not collapse. A variant cannot declare `path` or nested variants. Screen
variants inherit address, color schemes, related docs and tags unless they
override them; flow membership never inherits. A further situation is a sibling
screen in that owner's directory. A situation can own a directory too:
`product/viewer/standalone/build/index.mockup.tsx` owns the build details, and
the situations declared its siblings are screens beside it, never its
variants. Component variants use slugs such as
`primary`, with the same path rule.

The catalogue uses slug-derived titles and default order for Design, Site,
Flows, Product, Account, Recovery, Settings and Viewer. It needs no
`_folder.json` records for these folders.
A folder that owns an index screen/component uses that entry's title and
renders as an entry row in its own section; its record cannot set `title`.
The callback index has the title `Sign-in link · Pending`.

Folder records, the packaged `defineFolder` carrier and `movedFrom` hints
follow [Mokly folders](../mokly-folders.md) and [Mokly moves](../mokly-moves.md). This
catalogue authors no folder record and no `movedFrom` hint: folder metadata
changes presentation, never identity, and directory owners use the single
filename convention `index.mockup.tsx`.

Design holds Tokens, registered components, the Site folder with its tour,
and the Email folder. The delivered sign-in and invitation screens use the
`email` and `folio` tags in both viewports and schemes. They have no variants
because a delivered document has one state, per [Email](./email.md). Flows
holds product journeys; Product holds Account, Recovery, Settings and Viewer.
The Review family is deferred. The package's one path tree presents Specs and
Components. [Product mockups](./product-mockups.md) defines current paths and
states.

## Screen And Renderer Boundary

Each entry module exports one definition, as its default export.
No entry declares `dependencies`, and no component declares
`ownedDependencies`; Mokly derives the inputs of each render from its imports.
A `defineScreen` draws every view through one
`render(props, context)`, which renders the same named screen component for
mobile and desktop and passes `context.viewport` when composition differs.
Place that component under `src/screens/<area>/`; definitions
and flows contain no inline screen layout. Render both color schemes from that
same render. The Email screens are the exception: a delivered message inlines
its scheme and viewport rather than reading a query, so both axes come from
the generated document, per [Email](./email.md).

The renderer module's default export receives the entry's kind, path and
title, its props, the viewport, the color scheme and the rendered node.
It returns one wrapper node around that node.
Mokly assembles the document around the wrapper: the `html` element, the head,
the title from the entry's title, the collected styles and the stylesheet
links. The wrapper carries `lang`, `data-color-scheme`, `data-viewport` and the palette
class. A saved component variant's document therefore takes
the variant's own title. Token values enter each document as the
custom properties that [Design tokens](./design-tokens.md) defines. Static
control rendering follows
[Shared control rendering](./shared-control-rendering.md#static-rendering-and-navigation).

Mokly passes the renderer no tags, so the renderer chooses the palette from
the entry's kind. A component page takes paper, the palette of the Design
material. Every screen takes Canvas, the default surface family.
[Design token colors](./design-tokens-color.md) defines both palettes, and
each document takes the control theme of its palette. A registered component
inside a screen takes that screen's palette. Decision: the palette follows the
entry's kind, not a tag, because the renderer input carries no tags.

Screen components own a `main` landmark and one primary heading. The renderer
does not add product copy or duplicate landmarks. Each product screen carries
the root marker `data-mkc-screen="<entry-path>"`. That marker is consumer-owned
policy metadata, not a package API.
Notes and fixture explanations stay outside it. Catalogue-only links below
an artboard use the shared catalogue-links navigation and base styles.
Mokly supplies the frame around each view. Nested chrome belongs only to
registered illustration material and to the canvas frames of the viewer
drawings; never duplicate the owning screen chrome.

Every product screen has mobile and desktop plus light and dark output. A
screen and its at most four variants hold no more than five semantic states,
excluding viewport/theme multiplication. The parent is the canonical drawing; a
further situation is a sibling screen with its own variants in the same folder.

## Registered Base Components

Keep `defineComponent` registrations in their owning `*.mockup.tsx` entry.
The package also accepts definitions made in helper modules; this catalogue
registers in the entry because the discovered exporting module owns path
derivation and the entry CSS root. Screens import the `Component` wrapper
that the entry exports by name, and render it. Rendering the registered
component in screens preserves package-owned usage and change attribution.
Repeated uses of a registered component require distinct stable
`moklyInstance` keys, including uses reached through shared helpers or loops.

The Components view of the generated catalogue lists every registered
component with its props, slots and saved variants; the
[authoring guide](../../mockups/README.md#key-code) names the registry source.
Each component declares a closed `propSchema` in the JSON Schema 2020-12
profile of Mokly, with `additionalProperties: false` on every
object, and its own `props`, which its page renders first. Props
are plain JSON data. React content belongs in declared `slots`, and a saved
variant supplies its slot content through its `slots` map.
Expose finite choices through `enum` or `oneOf` constants and appropriate
`controls`. Saved variants use a required slug and derive
`<component-path>/<slug>`, such as `design/button/primary`. Render every
variant in both viewports and themes; keep each component to five saved
variants.

`design/textarea` and `design/comment-thread` are registered with their saved
variants and have no owning screen until the review phase; `design/switch`
draws the project pane's Automatic builds setting.
`design/review-illustration` is Design-only material with five saved variants
and no screen consumer; StatusDot and Skeleton keep their Design variants. The
illustration uses paper and contains fictional design material with an
accessible illustration label; decorative motifs are hidden from assistive
technology. Its review panel composes the registered thread; there is no
style selector.

Buttons, inputs, badges, avatars, dots and other controls use the registered
Firna wrappers in [Shared controls](./shared-controls.md). Ordinary card/thread
text uses Firna typography; headers, frame/card layout, content and illustrations
stay local. Keep app primitives aligned.

## Links And Flows

[Links and flows](./mockup-links-and-flows.md) defines mock links, slug
fixtures and use-case flows.

## Required Checks

[Mockup verification](./mockup-verification.md) defines policy fixtures,
source parity and disk/HTTP browser smoke. The tracking guard, determinism
guard and output tests protect the ignored output and its exact bytes.
Path-policy tests check the authoring rules above and those of
[links and flows](./mockup-links-and-flows.md). The
[Mockup source policy](./mockup-source-policy.md) keeps each authored source
free of inputs from the machine that builds it. Commit source, styles and
authored assets; Git ignores the build output.
