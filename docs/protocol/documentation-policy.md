# Documentation Policy

## The End-State Rule

Protocol pages define the intended end state of the product. A page states
what Mokly does, not what it did, not what it will do, and not when. No page
describes an earlier implementation, a former format number, a removed field,
or the history of its delivery.

A page whose behaviour is not implemented yet starts with one line directly
below its title:

```markdown
Status: In progress under the [Rust rebuild plan](../../plans/rust-rebuild.md).
```

That line is the only plan reference a page carries, and it is removed when the
behaviour is implemented. The root `README.md` also links the `plans/`
directory; no page carries another plan link. The plan names the milestone that implements each
page; a page never does. The protocol of the previous backend is at the commit
the plan names.

## Scope

The rule applies to Markdown under `docs/**`, the root `README.md`, the
package, example, and `xtask` READMEs, and authored `notes.md` files. The
guides under `docs/guides` have no status notes; they ship with the npm
package and describe the released product.

## Exceptions

A page may name an earlier format or a removed input where the rule it states
needs the name:

- A version gate that rejects an earlier number names that number.
- A removed-input warning or a consumer migration instruction names the input
  it removes.
- Fixed wire and hash identifiers keep their literal names.
- The npm release notes and the historical upgrade notes describe past
  releases and are history by nature.

## Checks

No test asserts the content of a protocol page. The repository gate caps a
protocol page at 250 lines, with the reviewed exceptions in
`xtask/protocol-document-caps.json`, and a repository test of `xtask` checks
that every local link and anchor resolves. Code is tested against its own
behaviour, never against the words of a page.

## Plans

One plan file per change lives under `plans/`, named after the change, with a
`Status:` paragraph below its title. There is no plans index; the `README.md`
links to the directory. In an active plan, completed milestones and checked
TODOs are history and keep their words; everything else is live. Evidence,
measurements, and review reports live under the git-ignored `.context/`.
