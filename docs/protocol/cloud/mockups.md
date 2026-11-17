# Mockup Catalogue Contract

The catalogue adopts exact-pinned `@mokly/mokly@0.19.0` and `@mokly/ui@0.19.0`.
Product UI follows its reviewed mockups. The
[authoring guide](../../mockups/README.md), [tokens](./design-tokens.md),
[site design](./site-design.md), and [copy rules](./product-copy.md) are part
of this specification.

## Package And Ownership

- Pin the published `@mokly/mokly` `0.19.0` release exactly in every consuming
  package, and pin `@mokly/ui` at the same version in each package that
  imports it. React and React DOM peers share one exact version
  that satisfies the packages' React 19 requirement. All consumers resolve one
  hoisted registry copy from the one npm workspace lockfile.
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
  policy tests, and screenshot evidence. A version bump is its own change and
  regenerates the `mkc-mokly-contract` fixtures.
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
follow the installed package's `mokly-folders.md` and `mokly-moves.md`. This
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
the entry's kind and path. Screens under `product/`,
`design/site/` and `design/email/` render in the Folio palette with its scoped
control theme. A component page keeps paper, and every other screen, such as
the token inventory, keeps the base palette. A registered component inside a
screen takes that screen's palette. Decision: the palette follows the entry's
kind and path, not a tag, because the pinned renderer input carries no tags.

Screen components own a `main` landmark and one primary heading. The renderer
does not add product copy or duplicate landmarks. Each product screen carries
the root marker `data-mkc-screen="<entry-path>"`. That marker is consumer-owned
policy metadata, not a package API.
Notes and fixture explanations stay outside it. Catalogue-only links below
an artboard use the shared catalogue-links navigation and base styles.
Mokly supplies device/browser chrome. Nested chrome belongs only to registered
illustration material and to the device frames of the viewer drawings; never
duplicate the owning screen chrome.

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
profile of the pinned release, with `additionalProperties: false` on every
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

Use `MockLink to="product/account/sign-up"`, a relative `./` or `../` path,
or an imported definition reference. Put a real anchor in separate `fragment`.
`mockLink` accepts the same targets. Ordinary entries resolve relative links
from the parent folder; an index uses its own path; variants use their parent's
base. Imported definitions must be exported by a discovered entry module.
Links identify their target by path or definition reference.

Use `MockLink asChild` around one supported enabled control. Keep styling and
accessibility props on that child; disabled controls stay inert. Follow
[placement tiers](./shared-control-rendering.md#static-rendering-and-navigation).
Every build, validation and publish that this repository runs uses
`--strict`, so both errors and warnings must be fixed in source. Cloud builds
of a customer's repository keep the runner's recorded arguments.

Do not use product routes such as `/sign-up` as mockup `href`s. Link the
catalogue path `product/account/sign-up` with `MockLink`. No rendered screen
holds a link or a resource URL that starts with `/`.
Public-site links use real external `href`s to the site origin fixture.
The running app resolves those paths on its shared app/site origin.

Product fixtures use slug routes such as `/mokly-team/mokly-cloud` and carry real
`workspace.slug` and `project.slug` fields; publication IDs remain UUIDs.
Create-workspace, both repository naming choices, project-created and the
workspace/project settings panes draw the slug and resulting address. The
two settings edits are the `product/settings/workspace/slug` and
`product/settings/project/slug` screens beside their panes rather than extra pane
states. Create-workspace and choose-repository also own suggestion-failure
screens, reusing their form components and showing retry plus editable fields.

A `defineUseCase` contains ordered `{ screenPath, title?, description? }`
steps.
It references existing screen entries, parents or variants; it neither
creates original screens nor duplicates JSX. Every referenced screen
reciprocally lists the use-case path in `useCasePaths`.
A variant never
inherits that membership, so a variant a step names declares it itself. Update
both sides when changing membership. Each displayed step links back to its
owning screen entry. Step explanations stay in the flow's package-owned
surroundings, not the screen. Flows may show more than five screens because
they reuse existing screens.

## Required Checks

[Mockup verification](./mockup-verification.md) defines policy fixtures,
source parity and disk/HTTP browser smoke. The tracking guard, determinism
guard and output tests protect the ignored output and its exact bytes.
Path-policy tests check the authoring rules above. The
[Mockup source policy](./mockup-source-policy.md) keeps each authored source
free of inputs from the machine that builds it. Commit source, styles and
authored assets; Git ignores the build output.
