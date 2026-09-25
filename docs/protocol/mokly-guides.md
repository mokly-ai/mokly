# Mokly Guides Contract

## Scope

This implemented contract makes this repository the owner of the versioned
documentation for the public Mokly CLI, the catalogue, and the formats that
hosting and upload services build against. The guides are plain Markdown
shipped in `@mokly/mokly` beside the protocol documents and changelog. The
private `mokly-cloud` repository owns the public documentation site and renders
the guides from an installed package version.

This repository does not build, test, or deploy that site. The cloud repository
also owns its Mokly Cloud, Review and edit, changelog, legal, and marketing
pages. The package is the version boundary: a site rendering one package
release must use that release's guides and changelog.

Protocol documents are implementation contracts for Mokly contributors. They
ship in the package, but they are not site content: the site renders no
protocol document, and no guide links to one. A fact that a user or integrator
needs from a protocol document is restated for that reader in a guide.

## Guide Sources And Routes

A guide lives at `docs/guides/<section>/<slug>.md`. Its directory is the
section id, its filename without `.md` is the route slug, and the cloud route is
`/docs/<section>/<slug>/`. Slugs use lowercase kebab-case.

Sections appear in this order:

| Order | Section id  | Title                  | Summary                                                         |
| ----- | ----------- | ---------------------- | --------------------------------------------------------------- |
| 1     | `start`     | Getting started        | Install Mokly, point it at your screens and open the catalogue. |
| 2     | `authoring` | Authoring              | Describe screens, components, flows and pages in TypeScript.    |
| 3     | `catalogue` | Catalogue              | Browse, search, compare and export what the build produced.     |
| 4     | `ci`        | Continuous integration | Publish a catalogue from a workflow on every branch.            |
| 5     | `cli`       | CLI reference          | Every command, the options it takes and what it writes.         |
| 6     | `reference` | Reference              | The files an export writes and the uploads a service accepts.   |

The cloud repository adds its own `cloud` and `review` sections and may place
them between these sections in its site order. They are not valid section
values in this repository's guides.

## Frontmatter

Every guide starts with a `---` frontmatter block containing exactly four
single-line fields in this order:

```yaml
---
title: "Install"
description: "Add Mokly to the repository that holds your screens."
section: "start"
order: 1
---
```

`title`, `description`, and `section` are double-quoted JSON strings, without
YAML collections, aliases, tags, or multiline forms. `order` is an unquoted
base-10 integer. The fields mean:

- `title` is the page title and navigation label and is not empty.
- `description` is the page summary, has no leading or trailing whitespace, and
  contains 1 to 180 Unicode characters.
- `section` is one of the six ids above and equals the containing directory.
- `order` is positive and unique within its section. Pages in a section render
  in ascending order.

No other field is allowed. In particular, `status: ahead` is reserved for
cloud-owned pages and never appears in a packaged guide.

## Markdown Body

Guide bodies use CommonMark with GitHub-style tables and fenced code blocks.
Every fence names a language. The frontmatter supplies the page title, so the
body contains no level-one heading and does not repeat that title. Body
headings start at level two, and the same heading text does not occur twice in
one page.

Outside code fences, HTML is forbidden except for comments. Comments carry
release automation markers but render no reader-visible content. JSX, ESM
imports, MDX components, and other executable extensions are forbidden outside
code examples. Shell commands belong in language-labelled code fences.

## Guide Links

The guide corpus contains no links. Future links use only these forms:

- another guide: `/docs/<section>/<slug>/`, naming a guide that exists in the
  same package release;
- the documentation or changelog site route: `/docs/` or `/changelog/`; or
- an absolute HTTP or HTTPS URL.

A fragment may follow an allowed route or absolute URL. A guide never links to
a repository file path, relative Markdown path, unversioned GitHub source,
protocol document, or another cloud-owned route. Until links are introduced,
prose names another guide by its section and title.

## Reference Section

The `reference` section documents the formats an integrator builds against. Its
readers host an exported catalogue or run a service that accepts
`mokly publish` uploads. It contains these guides in this order:

| Order | Guide                          | Covers                                                             |
| ----- | ------------------------------ | ------------------------------------------------------------------ |
| 1     | `reference/export-files.md`    | Export layout, the ownership marker, and the headers a host serves |
| 2     | `reference/upload-receiver.md` | The upload request, responses, manifest, archive rules, and limits |

Reference guides follow every other guide rule. They state the exact files,
fields, headers, status codes, and limits an integrator observes or must
implement, and they never describe Mokly's internal modules, algorithms, tests,
delivery status, or plans. The [export delivery](./mokly-export-delivery.md),
[export ownership](./mokly-export-ownership.md), and
[catalogue upload](./mokly-upload.md) protocol documents remain the
implementation contracts behind them. A change to a public value in one of
those contracts updates the matching reference guide in the same change, and
root tests compare both reference guides with the implementation.

Package versions up to and including 0.12.0 asked the site to publish six
protocol documents under `/docs/reference/<slug>/`. Later versions withdraw
that allowlist: the site renders the `reference` section from
`docs/guides/reference/` like every other package section and publishes no
protocol document.

## Versions And Releases

Guides write package versions as literals, never placeholders. Every semantic
version literal in `docs/guides/` equals the root `package.json` version.
`start/install.md` uses it both in the pinned install command and in the
sentence naming the documented version. `ci/github-action.md` uses it as the
example Action `version`.

Those version-bearing lines are enclosed by these HTML comments:

```markdown
<!-- x-release-please-start-version -->

The version-bearing prose or fenced block is here.
<!-- x-release-please-end -->
```

Markers sit outside a fenced block rather than inside it. The root package's
Release Please configuration lists both Markdown files as `generic`
`extra-files`, so a release PR updates the literals with `package.json`. Root
tests reject a missing marker, a stale literal, or any other version literal
that differs from the package version.

## Package Publication

The root package `files` allowlist contains both `docs/guides` and
`docs/protocol`. A packed package contains the complete guide tree, all protocol
documents and their public compatibility fixtures, `CHANGELOG.md`, and the
existing runtime surface. Tests, plans, examples, site sources, and
repository-only tooling remain excluded.

The cloud site reads documentation only from an installed package. It does not
copy an unpublished working tree or mix guides or changelog text from different
package versions.

## Writing And Verification Rules

- Document only commands, flags, fields, exports, and behavior verified against
  the current implementation.
- Use present tense. Do not use "coming soon", invent customers or figures, or
  tell readers what Mokly does not do.
- Prefer one concept per page and keep a guide around 200 lines or fewer.
- Use product nouns in headings. Put exact code identifiers in code spans,
  tables, or examples.
- Write reader-facing outcomes and actions. Keep internal schema, pipeline,
  environment, and implementation vocabulary out of headline copy unless it is
  itself the documented public interface.
- Name Mokly's own files only when they are part of the public interface, such
  as exported artifacts or the packaged compatibility fixtures. Never cite
  protocol documents, plans, milestones, delivery status, source modules, or
  tests; root tests reject that vocabulary in guide prose.
- Root tests validate structure, links, versions, copy, the CLI surface,
  configuration fields, public authoring exports, the upload/CI contract, and
  the reference formats.

## Related Docs

- [Package and authoring contract](./mokly-package.md)
- [CI and npm release contract](./npm-release.md)
