---
title: "Install"
description: "Add Mokly to the repository that holds the components your screens are made of."
section: "start"
order: 1
---

## Install the package

Mokly runs from your own repository as a development dependency. React and
React DOM render your screens, so install them beside it.

```shell
npm install --save-dev @mokly/mokly react react-dom
```

<!-- x-release-please-start-version -->

The package is `@mokly/mokly` and its executable is `mokly`. This
documentation describes version 0.13.0.
<!-- x-release-please-end -->

## Run the command

Run the local executable with `npx`. In a repository that has Mokly as a
development dependency, `--no-install` keeps npm from reaching the registry.

```shell
npx --no-install mokly --version
```

On a machine without the dependency you can run one published release
directly:

```shell
npx --package @mokly/mokly mokly --help
```

## Pin a version

To reproduce one exact release, on another machine or in a job, install the
version rather than the range:

<!-- x-release-please-start-version -->

```shell
npm install --save-dev @mokly/mokly@0.13.0
```

<!-- x-release-please-end -->

## What you need

- Node.js 22.14 or newer, except Node 24.14 through 24.18. If you use Node 24,
  select 24.19 or later to avoid the affected runtime releases.
- A repository with React components, or somewhere to write new ones.
- Git, once you want to compare a branch with its base.

## Next

Create the configuration that tells Mokly where your screens live and where
the catalogue is written.
