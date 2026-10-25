# Packed Consumer Smoke

Status: In progress under the [Rust rebuild plan](../../plans/rust-rebuild.md).

`npm run package:smoke` builds first, then packs `@mokly/viewer`,
`@mokly/mokly`, and the host's native package with `npm pack`, so the real
`prepack` builds run. It copies `examples/`, with the `docs/` and `plans/` pages
that the example's documents link to, into a scratch consumer outside the
repository, in the repository layout that the example's `repoRoot` and its asset
outside the catalogue root need. It installs the three archives and the
example's own dependencies at the versions the workspace installed.

Through the installed shim it starts `mokly serve --no-watch --sidecars 1` in
`examples/basic/specs/example/team`, so Serve discovers the configuration
upward. Serve runs in its own process group, as the [fixture lifetime
rules](./ci-suite-evidence.md#fixture-lifetime-and-cleanup) require. The smoke
drains that group on every path, also on an interrupt, and keeps the scratch
directory for diagnosis when the drain cannot confirm that every process ended.
Headless Chrome opens a React, a design, and an HTML screen and a Markdown
document in the Browse shell. It waits for each view's text and for the
document's image, with no page error, failed request, or console error other
than the viewer's sandbox reports. A navigation's cancelled requests, the
cancelled event stream, and a cancelled index or detail refresh are no failures.
Then `mokly build --strict --no-changes --sidecars 1 --out ../../site` with an
explicit `--config` writes the site beside `examples/`, because a relative
`--out` resolves against the configuration's directory. The site must hold its
home, not-found, and shell route files. A plain file server serves the site,
Chrome opens the same entries, and the site requests no live endpoint.

Last, the smoke removes the installed Mokly packages from the copy and runs
`npm exec --package` with the three archives and an empty npm cache in the
configuration's directory. `mokly --version` installs the archives into that
cache. Every load of React and React DOM from there then fails, and the
renderer's and the PostCSS configuration's imports exist only in the copy. So
`mokly build --strict --no-changes --sidecars 1 --out ../../npx-site` proves
that these modules resolve from the copy, as the [rendering
boundary](./mokly-rendering.md#rendering-boundary) requires. It must discover
the configuration, write the same files as the first build, and install nothing
into the copy.

The smoke runs on Linux and macOS, and its install needs registry access. Set
`MOKLY_SMOKE_CHROME` to a Chrome executable when Playwright's browser is not
installed. The smoke stays outside every suite of `cargo xtask check`; the
release workflow's clean-consumer smokes check the release archives.
