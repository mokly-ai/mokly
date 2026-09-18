# Mokly Guides Contract

## Scope

This implemented contract makes this repository the owner of the versioned
documentation for the public Mokly CLI and catalogue. The guides are plain
Markdown shipped in `@mokly/mokly` beside the published protocol documents and
changelog. The private `mokly-cloud` repository owns the public documentation
site and renders the files from an installed package version.

This repository does not build, test, or deploy that site. The cloud repository
also owns its Mokly Cloud, Review and edit, changelog, legal, and marketing
pages. The package is the version boundary: a site rendering one package
release must use that release's guides, protocol documents, and changelog.

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

The cloud repository may add its own `cloud`, `reference`, and `review`
sections. They are not valid section values in this repository's guides.

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
- `section` is one of the five ids above and equals the containing directory.
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

The initial guide corpus contains no links. Future links use only these forms:

- another guide: `/docs/<section>/<slug>/`;
- one of the published protocol documents:
  `/docs/reference/<reference-slug>/`;
- the documentation or changelog site route: `/docs/` or `/changelog/`; or
- an absolute HTTP or HTTPS URL.

A fragment may follow an allowed route or absolute URL. A guide never links to
a repository file path, relative Markdown path, unversioned GitHub source, or
another cloud-owned route.

## Published Protocol Documents

The package ships all protocol sources, but the cloud Reference section
publishes only these documents in this order:

| Order | Package source                            | Reference slug     |
| ----- | ----------------------------------------- | ------------------ |
| 1     | `docs/protocol/mokly-export-delivery.md`  | `export-delivery`  |
| 2     | `docs/protocol/mokly-export-ownership.md` | `export-ownership` |
| 3     | `docs/protocol/mokly-upload.md`           | `upload`           |
| 4     | `docs/protocol/mokly-navigation.md`       | `navigation`       |
| 5     | `docs/protocol/mokly-link-controls.md`    | `link-controls`    |
| 6     | `docs/protocol/mokly-pages.md`            | `pages`            |

The cloud renderer removes a published protocol document's first level-one
heading and uses it as the page title. It preserves fragment-only and absolute
HTTP(S) links. A relative link to another allowlisted protocol source maps to
that source's Reference route, retaining its fragment. Any other relative
repository link maps to the corresponding file at the package's immutable
release tag:

```text
https://github.com/mokly-ai/mokly/blob/v<package-version>/<repository-path>
```

Authors therefore keep protocol links relative. The cloud renderer resolves
and normalizes the target against the source document before applying this
mapping and rejects a path that escapes the repository.

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
documents, `CHANGELOG.md`, and the existing runtime surface. Tests, plans,
examples, site sources, and repository-only tooling remain excluded.

The cloud site reads documentation only from an installed package. It does not
copy an unpublished working tree or mix guides, references, or changelog text
from different package versions.

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
- Root tests validate structure, links, versions, copy, the CLI surface,
  configuration fields, public authoring exports, and the upload/CI contract.

## Related Docs

- [Package and authoring contract](./mokly-package.md)
- [CI and npm release contract](./npm-release.md)
