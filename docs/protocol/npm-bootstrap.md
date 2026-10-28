# One-Time Mokly Registry Bootstrap

npm can configure a trusted publisher only for a package that already exists.
The first publication of each package is therefore a one-time, reviewed,
interactive registration. Every later version follows the
[release contract](./npm-release.md). Never move an existing Git tag or reset
release-please state to recreate a version.

## Registered Packages

`@mokly/mokly`, `@mokly/viewer`, and the five `@mokly/native-{target}`
packages are registered. The `bootstrap` dist-tag stays on each registration
version: `@mokly/mokly` 0.8.0, `@mokly/viewer` 0.1.0, and each native package
0.0.0. Reviewed releases advance `latest`. Never repeat a registration,
republish a registration version, remove `latest`, or unpublish a package to
undo a registration.

Every registered package has its own trusted publisher: repository
`mokly-ai/mokly`, workflow `release.yml`, environment `npm`, and direct
`npm publish`. Every registered package also has `mokly:developers` access,
public access, required 2FA, and disabled token bypass. The trust
configuration of one package is not evidence for another.

A registration is an interactive maintainer publication, not an OIDC
publication. Its evidence is the reviewed source, the inventory, the hashes,
and the npm signatures. npm signatures alone do not prove workflow provenance.
The first publication through the package's own trusted publisher supplies
its first OIDC attestation.

Setup evidence from an earlier release does not prove that a package's
publisher, team access, or tag protections remain configured. Read back the
current GitHub and npm settings before each release.

## Native Package Registration

Register each `@mokly/native-{target}` package once, before the first
coordinated release that publishes it. The read-only
[native bootstrap workflow](../../.github/workflows/native-bootstrap.yml)
builds the five registration archives. A maintainer reviews and publishes them.

The workflow accepts only a manual dispatch with one input, `commit`: the
reviewed full 40-character commit SHA. It rejects any other value before a
build starts. It has contents-read permission only, with no npm environment,
OIDC permission, secret, npm token, or registry write, and it never publishes.
Its matrix holds the targets and runners of the release workflow's native
build, with the same pinned actions, Node.js, npm, Rust, dependency install
without lifecycle scripts, and Linux Zig and cargo-zigbuild setup. Each job
checks out the commit without persisted credentials and runs the bootstrap
command for its target:

```sh
node scripts/release/bootstrap.mjs {sha} .context/native-bootstrap/{target} @mokly/native-{target}
```

The command requires `HEAD` to equal the supplied SHA and a clean source tree,
including staged and untracked files. The destination must not exist. The
command builds in a fresh isolated checkout that holds only the reviewed
commit, so ignored local build output, dependencies, and caches cannot reach
the archive, and the build must not need earlier Git history. It checks the
runtime license closure, verifies that the source is still clean and at the
reviewed commit after the build, and recomputes the archive hashes before it
writes the result. It never publishes, changes package versions, moves refs,
or edits the source checkout. It removes its temporary build data on success
and failure.

A maintainer can run the same command for one target on a matching host, from
a clean checkout of the commit, after `npm ci --ignore-scripts`. The command
itself needs the installed dependencies. On Linux, prepare the pinned Zig and
cargo-zigbuild tools first. The command's isolated checkout installs npm
dependencies with lifecycle scripts disabled and builds with the release
runtime floors. Each workflow job uploads its destination directory as the
artifact `native-bootstrap-{target}` and keeps it for 30 days. A job without
output fails. The artifact holds exactly three files:

- `mokly-native-{target}-0.0.0.tgz`: the archive to publish. Native
  registration always packs version `0.0.0`, which no coordinated CLI release
  publishes. Packing does not modify the reviewed checkout.
- `pack-report.json`: the inventory, version, `integrity`, and `shasum`, with
  the `sourceCommit` and `sourceTree` Git IDs. `binaryVersion` records the CLI
  version that the binary embeds. The Git IDs are local build evidence, not
  npm's `gitHead` or signed OIDC provenance.
- `tls-dependencies.txt`: the same library dependency inspection as a
  coordinated build.

A maintainer registers the five packages from one machine. Each registration
meets these requirements:

1. The report names `@mokly/native-{target}` and version `0.0.0`. Its
   `sourceCommit` is the reviewed commit, and its `binaryVersion` is the CLI
   version of that commit. Its inventory holds only `LICENSE`, `README.md`,
   `package.json`, and the target binary. The SHA-1 and SHA-512 of the archive
   match `shasum` and `integrity`. The maintainer reads
   `tls-dependencies.txt`.
2. An approved maintainer account with 2FA publishes the reviewed archive with
   the `bootstrap` dist-tag and public access:

   ```sh
   npm publish {archive} --tag bootstrap --access public
   ```

3. The registry entry matches the report:

   ```sh
   npm view @mokly/native-{target}@0.0.0 name version dist.integrity dist.shasum
   ```

   npm can also set `latest` to the first version. The first coordinated
   release moves it.

4. The package has its own trusted publisher and the access settings of
   [every registered package](#registered-packages). The maintainer reads
   back the CLI and viewer publishers too.

Then the coordinated release, or a retry under the
[release recovery rules](./npm-release-management.md#release-recovery),
publishes through OIDC. Never repeat a registration. Do not use registration
bytes as a coordinated release or retry artifact.
