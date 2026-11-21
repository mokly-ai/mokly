# Mockup Tooling

Status: The `@mokly/ui` stylesheet does not name Geist and Geist Mono yet. [Milestone 3](../../../plans/canvas-redesign.md#milestone-3-palette-source-fonts-and-brand) builds the fonts.

This is the configuration and command sub-contract of [Mockups](./mockups.md).

## Configuration And Scripts

Keep the web aliases, conditions, JSX loader, extensions and public package
mappings in
[Shared control rendering](./shared-control-rendering.md#module-resolution)
together.
Canonical definitions live under `docs/mockups/src/entries`; shared TSX
components live under `docs/mockups/src/components`.
The root npm workspace supplies one shared React runtime. The configuration is the data-only
`mokly.config.json` at the repository root, with the values in this table.

| Field                           | Value                                                                        |
| ------------------------------- | ---------------------------------------------------------------------------- |
| `repoRoot`                      | `.`                                                                          |
| `roots`                         | `[{ "dir": "docs/mockups/src/entries", "files": ["**/*.mockup.{ts,tsx}"] }]` |
| `renderer`                      | `docs/mockups/src/render.tsx`                                                |
| `colorSchemes`                  | `["light", "dark"]`                                                          |
| `moduleResolution.packageRoots` | `["."]`                                                                      |
| `stylesheets`                   | The four entry-route rules below                                             |
| `review.base`                   | `origin/main`                                                                |

The configuration names no output directory, rebuild recipe or shared-impact
list, because Mokly has none of these fields.

Stylesheet rules match the entry route `<path>/index.html`, not the generated
view route. Use `design/site/**/index.html`, then
`design/email/**/index.html`, then
`product/{account,recovery,settings,viewer}/**/index.html`, then `**/*.html`.
Email views link only the base and inbox-frame styles; their message body
uses inline styles per [Email](./email.md).
First match wins; an unmatched path receives Design styles. These rules
apply across viewports and schemes.
Configured links precede the renderer's bundled CSS, then the entry's bundled
CSS. Every path in the configuration, stylesheet files included, is relative
to the configuration file.

Build and check pass `--strict`. Runtime and type mappings use documented
public entrypoints from the single installation.
The `cloud-mockups` suite runs build, check, test and typecheck in that order.

## Imported Viewer Styles

Mokly owns CSS loading, and the configuration sets no CSS loader. The viewer
drawings import `@mokly/ui/styles.css`, the package's only stylesheet subpath,
with a side-effect import. Mokly bundles imported CSS into the
entry's stylesheet and links it after the configured sheets. No mockup imports
`@mokly/viewer/styles.css` or a component stylesheet of `@mokly/ui`.

The package stylesheet names Geist and Geist Mono, the faces of the
[Canvas palette](../mokly-viewer-palette.md#canvas-palette), and loads no font
file, so the viewer drawings use the catalogue's own self-hosted Geist and
Geist Mono. Mokly mirrors each file that imported CSS references at
`static/mokly-generated/assets/<repository-relative source path>` in the build
output. The receiver adopts these asset paths per
[hosting policy](./publication-upload-validation.md#hosting-policy).
[Repository generated files](./repository-generated-files.md) owns the ignore
rules.

## Output And Check Ownership

`npm run mockups:build` runs `build --strict --no-changes` and writes the
static catalogue to the ignored `mokly-static/` at the repository root.
The output holds the shell, the catalogue index at
`mokly-viewer/index.json`, one entry detail per entry under
`mokly-viewer/entries/`, and every view at
`static/mokly-generated/<path>/index.<viewport>[.dark].html` with its bundled
styles and assets. Decision: the local build runs without
Changes, not with a comparison, because its tests read
current content only. A comparison would make every build read
Git history and possibly install the base's dependencies.

`npm run mockups:check` runs `build --strict --no-changes --out` into an
ignored directory under `.context/`, so validation never replaces the output
that the tests read. Beyond the output and reservation
directories of its builds, Mokly writes nothing into the repository.
Serve keeps its documents in memory, Publish builds in a
private directory, and Mokly keeps its caches outside the repository.

Authored assets enter the output only through the referenced public closure.
Keep source and `.context` out of public resources. Never hand-edit output or
create another cloud inventory. Mokly owns its JSON, compiled CSS and HTML
bytes. Prettier reads the repository's root ignore files, and
[Repository generated files](./repository-generated-files.md) defines the
ignore rules.

Commit authored source, styles and assets; keep every output directory
untracked and ignored.
The contract golden files and generated OpenAPI client remain tracked; see
[Repository generated files](./repository-generated-files.md).

Build precedes check, test and typecheck. Run these commands from the root:

```sh
npm run mockups:build
npm run mockups:check
npm run mockups:test
npm run mockups:typecheck
```

The build output supplies the policy and browser tests.
The [determinism guard](./mockup-verification.md#build-determinism) of the
`cloud-mockups` suite
compares two independent builds byte for byte, including the catalogue index,
the entry details, the CSS and the binary assets.
The guard must fail and list every differing path; browser policy alone cannot
replace it.
The tracking guard in [Mockup verification](./mockup-verification.md#derived-output-regressions)
rejects committed output.

Publish requires a clean committed source checkout. It checks HEAD and status
before it builds and again before Plan, and a dirty checkout fails with
`git-uncommitted` before any receiver request. Publish builds from sources in
its own directory, so local output never changes the published bytes.
The served tests start Serve under the base rule of
[Mockup verification](./mockup-verification.md#disk-and-http-smoke).

## Comparison Base

[Mockup baselines](./mockup-baselines.md) defines the comparison base, its
dependency installs, the Serve and fixture rules, the cache and the trust
boundary. [Preview capture](./preview-capture.md) defines its comparison
requirement and publish deadline.

## Variant Slugs

A variant declares an explicit slug beneath its file-derived parent path.
`product/settings/workspace/slug-recovery/error` uses slug `error` beneath
`product/settings/workspace/slug-recovery`. Case and authored order are
preserved. These variants use the following authored slugs. Titles and
filename suffixes do not determine them.

| Parent path                                  | Slug             |
| -------------------------------------------- | ---------------- |
| `product/account/callback/email-invalid`     | `expired`        |
| `product/account/callback/email-invalid`     | `used`           |
| `product/account/callback/email-invalid`     | `failure`        |
| `product/account/callback/preview-invalid`   | `failure`        |
| `product/settings/project/visibility`        | `plan`           |
| `product/settings/project/visibility`        | `plan-admin`     |
| `product/settings/tokens/create`             | `reveal`         |
| `product/settings/tokens/create`             | `copy`           |
| `product/settings/tokens/revoke`             | `menu`           |
| `product/viewer/standalone/catalogue`        | `comparison`     |
| `product/viewer/standalone/build/failed`     | `timed-out`      |
| `product/viewer/standalone/build/failed`     | `infrastructure` |
| `product/viewer/standalone/build/failed`     | `plan`           |
| `product/viewer/standalone/build/failed`     | `version`        |
| `product/viewer/standalone/build/superseded` | `cancelled`      |
| `product/viewer/standalone/publish`          | `publishing`     |

Component saved variants use the same parent-path and slug rule. Policy tests
check each variant's parent, kind and complete path.
