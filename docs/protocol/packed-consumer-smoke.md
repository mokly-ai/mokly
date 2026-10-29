# Packed Consumer Smoke

`npm run package:smoke` builds first, then packs `@mokly/ui`, `@mokly/viewer`,
`@mokly/mokly`, and the host's native package with `npm pack`, so the real
`prepack` builds run. It installs the four archives into a scratch consumer
outside the repository. The consumer holds a copy of `examples/` and
`packages/ui/src/`, with the `docs/` and `plans/` pages that the example's
documents link to, in the repository layout. It needs the UI package sources
because the design mockups import them by repository path. It also holds the
example's own dependencies at the versions that the workspace installed.

The smoke proves three things:

- Serve, started through the installed shim from a nested catalogue directory,
  discovers the configuration upward. Headless Chrome opens a React, a design,
  and an HTML screen and a Markdown document in the Browse shell. Each view's
  text and the document's image appear, with no page error, failed request, or
  console error other than the viewer's sandbox reports. A navigation's
  cancelled requests, the cancelled event stream, and a cancelled index or
  detail refresh are no failures.
- `mokly build --strict --no-changes` writes a site with its home, not-found,
  and shell route files. A plain file server serves the site, Chrome opens the
  same entries, and the site requests no live endpoint.
- With the installed Mokly packages removed from the copy,
  `npm exec --package` with the four archives and an empty npm cache runs the
  same strict build in the configuration's directory. Every load of React and
  React DOM from that cache fails, and the renderer's and the PostCSS
  configuration's imports exist only in the copy. The build therefore proves
  that these modules resolve from the copy, as the
  [rendering boundary](./mokly-rendering.md#rendering-boundary) requires. It
  discovers the configuration, writes the same files as the first build, and
  installs nothing into the copy.

Serve runs in its own process group, as the
[fixture lifetime rules](./ci-suite-evidence.md#fixture-lifetime-and-cleanup)
require. The smoke drains that group on every path, also on an interrupt, and
keeps the scratch directory for diagnosis when the drain cannot confirm that
every process ended.

The smoke runs on Linux and macOS, and its install needs registry access. Set
`MOKLY_SMOKE_CHROME` to a Chrome executable when Playwright's browser is not
installed. The smoke stays outside every suite of `cargo xtask check`; the
release workflow's clean-consumer smokes check the release archives.
