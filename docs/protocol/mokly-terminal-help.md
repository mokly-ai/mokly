# CLI Help And Version Bytes

Status: In progress under the [Rust rebuild plan](../../plans/rust-rebuild.md).

Help and version write UTF-8 to stdout, end with exactly one LF, write no
stderr, and exit 0. They contain no ANSI sequences or progress. The bytes do
not depend on output mode, colour, terminal width, or timing mode.

`--version` and `-v` print the `version` value of
`packages/mokly/package.json` followed by LF. For example, a package version
of `0.14.0` writes exactly `0.14.0\n`, with no command name or spaces.
The binary embeds that package value at build time.

Both `--help` and `-h` print the following exact blocks for their command,
including the final LF inside each block. A command comes first and its
options follow it. The command-less form accepts Serve options. Short flags
accept neither assignments nor trailing text. Repeated options fail.

## mokly

```text
Build and browse static mockup catalogues

Usage: mokly [OPTIONS]
       mokly <COMMAND>

Commands:
  serve    Serve the catalogue and comparisons; watch by default
  build    Validate, render every view, and write the static site
  publish  Build into a private directory and upload

Options:
  -v, --version              Show the installed package version
      --config <CONFIG>      Configuration JSON path; otherwise search upward
      --base <BASE>          Comparison base ref; overrides review.base (default origin/main)
      --base-install-scripts Run lifecycle scripts during base dependency installation
      --no-base-install-scripts
                             Keep lifecycle scripts disabled during base dependency installation
      --sidecars <SIDECARS>  Sidecar count; defaults to MOKLY_SIDECARS or the core count
      --debug-timings        Write timing JSON to stderr and select plain output
      --port <PORT>          Starting port, 0 through 65535 (default 4173)
      --watch                Watch source files (the default)
      --no-watch             Serve one snapshot without watching files
      --open                 Open the catalogue after its URL is ready
  -h, --help                 Print help

Configuration: search upward for mokly.config.json, or pass --config PATH.
```

## mokly serve

```text
Serve the catalogue and comparisons; watch by default

Usage: mokly serve [OPTIONS]

Options:
      --config <CONFIG>      Configuration JSON path; otherwise search upward
  -v, --version              Show the installed package version
      --base <BASE>          Comparison base ref; overrides review.base (default origin/main)
      --base-install-scripts Run lifecycle scripts during base dependency installation
      --no-base-install-scripts
                             Keep lifecycle scripts disabled during base dependency installation
      --sidecars <SIDECARS>  Sidecar count; defaults to MOKLY_SIDECARS or the core count
      --debug-timings        Write timing JSON to stderr and select plain output
      --port <PORT>          Starting port, 0 through 65535 (default 4173)
      --watch                Watch source files (the default)
      --no-watch             Serve one snapshot without watching files
      --open                 Open the catalogue after its URL is ready
  -h, --help                 Print help
```

## mokly build

```text
Validate, render every view, and write the static site

Usage: mokly build [OPTIONS]

Options:
      --config <CONFIG>      Configuration JSON path; otherwise search upward
  -v, --version              Show the installed package version
      --base <BASE>          Comparison base ref; overrides review.base (default origin/main)
      --base-install-scripts Run lifecycle scripts during base dependency installation
      --no-base-install-scripts
                             Keep lifecycle scripts disabled during base dependency installation
      --sidecars <SIDECARS>  Sidecar count; defaults to MOKLY_SIDECARS or the core count
      --debug-timings        Write timing JSON to stderr and select plain output
      --out <OUT>            Static output directory (default mokly-static/)
      --strict               Fail on warnings before writing output
      --no-changes           Skip comparisons and base lookup
  -h, --help                 Print help
```

## mokly publish

```text
Build into a private directory and upload

Usage: mokly publish [OPTIONS]

Options:
      --config <CONFIG>
          Configuration JSON path; otherwise search upward
  -v, --version
          Show the installed package version
      --base <BASE>
          Comparison base ref; overrides review.base (default origin/main)
      --base-install-scripts
          Run lifecycle scripts during base dependency installation
      --no-base-install-scripts
          Keep lifecycle scripts disabled during base dependency installation
      --sidecars <SIDECARS>
          Sidecar count; defaults to MOKLY_SIDECARS or the core count
      --debug-timings
          Write timing JSON to stderr and select plain output
      --endpoint <ENDPOINT>
          Plan endpoint; overrides MOKLY_ENDPOINT
      --token <TOKEN>
          Bearer credential; overrides MOKLY_TOKEN
      --repository <REPOSITORY>
          Repository identity as host/owner/name
      --upload-concurrency <UPLOAD_CONCURRENCY>
          Maximum parallel Blob requests, 1 through 32 [default: 8]
      --strict
          Fail on every build warning before uploading
      --no-changes
          Skip comparisons and base lookup
  -h, --help
          Print help
```
