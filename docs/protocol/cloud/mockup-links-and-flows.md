# Mockup Links And Flows

This continues the [mockup catalogue contract](./mockups.md) for the links
between mockups, the slug fixtures and the use-case flows.

## Links

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

## Slug Fixtures

Product fixtures use slug routes such as `/mokly-team/mokly-cloud` and carry real
`workspace.slug` and `project.slug` fields; publication IDs remain UUIDs.
Create-workspace, both repository naming choices, project-created and the
workspace/project settings panes draw the slug and resulting address. The
two settings edits are the `product/settings/workspace/slug` and
`product/settings/project/slug` screens beside their panes rather than extra pane
states. Create-workspace and choose-repository also own suggestion-failure
screens, reusing their form components and showing retry plus editable fields.

## Use-Case Flows

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

## Related Docs

- [Mockup catalogue contract](./mockups.md)
- [Shared control rendering](./shared-control-rendering.md)
- [Mockup verification](./mockup-verification.md)
