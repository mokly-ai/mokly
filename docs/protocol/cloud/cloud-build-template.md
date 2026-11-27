# Cloud Build Template

This sub-contract of [Cloud build runner](./cloud-build-runner.md) defines the
E2B template in which every build attempt runs: its base image, its tools, its
workload user and environment, and the candidate assertion that checks each
release. The [build template runbook](../../ops/build-template.md) gives the
release procedure and the live probe, and it records each release.

## Base Image

The template, `mokly-build-v<N>`, has 2 vCPU and 4 GiB of memory.
`infra/e2b/build/e2b.Dockerfile` pins its base image as
`debian:<tag>@sha256:<64 lowercase hex>`. The digest fixes the image, so a new
tag cannot change the base of a template release. The tag records the source of
the digest.
The [build toolchain checks](./repository-layout.md#build-toolchain-checks)
reject any other base.

Decision: the base is a plain Debian image. Rejected: `e2bdev/base`, because a
base that brings its own Node, npm or Python can mix two releases of one tool.

The template runs Linux x64 with glibc 2.28 or newer, because the CLI is a
native binary with no musl build and no JavaScript fallback.

## Tools

The template supplies `/bin/sh`, coreutils, Python 3, curl and CA certificates.

It supplies an exact Node release with npm and corepack on the process `PATH`.
That release is the repository's pin in `.nvmrc`, which `toolchain-pins`
compares with the template definition, so the template satisfies the CLI's
engines.

It supplies Git 2.43 or newer, which supports Perl-compatible patterns in
`git grep -P`. The CLI reads a comparison base with
`git cat-file --batch --filters -Z`, which Git 2.42 added. The floor is 2.43,
the oldest release with a recorded working comparison.

It supplies a C compiler, a C++ compiler, `ar`, `ld`, `make`, `pkgconf`, which
provides the `pkg-config` command, and `libtool`. With these tools, a
consumer's install can build a native addon from source.

The process `PATH` holds exactly one real file each for `node`, `npm`, `npx`,
`corepack`, `python3` and `git`. Two paths to one file count as one file.

## Workload User And Environment

The template has the non-root workload `user`, which owns `/workspace`. It sets
`HOME=/home/user`. It contains no file at `/home/user/.mokly-git-credentials`,
so the runner's [credential write](./cloud-build-runner.md#steps) creates a new
0600 file rather than keeping a pre-existing mode.

E2B sets the process `PATH`. A build command gets the template environment with
its own entries added, not replaced.

## Candidate Assertion

The candidate assertion runs in a fresh sandbox of the template build under
test, with one added environment entry. It checks the added entry, `HOME` and
the tools on `PATH`, not the exact `PATH` (decided 2026-11-24), because E2B sets
its own `PATH` order. It also checks:

- the glibc floor
- the Git floor, and that `git cat-file --batch --filters -Z` runs
- that `node`, `npm`, `npx`, `corepack`, `python3` and `git` each have one real
  file on `PATH`
- that `pkg-config` and `libtool` run
- a native build: it builds and runs a small program from one C file and one
  C++ file, offline, through `make`'s default rules, with the `cc`, `g++`, `ar`
  and `ld` that node-gyp uses

Decision: the native build uses the assertion's own sources. Rejected: a forced
source build of a published addon, because it needs the network.
